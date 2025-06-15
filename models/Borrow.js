const mongoose = require("mongoose");

const borrowSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    book_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: [true, "Book is required"],
    },
    status: {
      type: String,
      enum: {
        values: [
          "requested",
          "approved",
          "borrowed",
          "returned",
          "rejected",
          "renewed",
          "renew_requested",
        ],
        message: "Invalid borrow status",
      },
      default: "requested",
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    issueDate: {
      type: Date,
      required: function () {
        return ["approved", "issued", "returned", "renewed"].includes(
          this.status
        );
      },
    },

    dueDate: {
      type: Date,
      required: function () {
        return ["approved", "issued", "returned", "renewed"].includes(
          this.status
        );
      },
    },
    returnDate: {
      type: Date,
      required: function () {
        return this.status === "returned";
      },
    },
    renewCount: {
      type: Number,
      default: 0,
      min: [0, "Renew count cannot be negative"],
      max: [3, "Maximum 3 renewals allowed"],
    },
    fineAmount: {
      type: Number,
      default: 0,
      min: [0, "Fine amount cannot be negative"],
    },
    totalFine: {
      type: Number,
      default: 0,
      min: [0, "Total fine cannot be negative"],
    },
    lastFineCalculated: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      required: function () {
        return this.status === "rejected";
      },
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.status === "issued";
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// FIXED: Compound indexes with correct field names
borrowSchema.index({ user_id: 1, status: 1 });
borrowSchema.index({ book_id: 1, status: 1 });
borrowSchema.index({ dueDate: 1, status: 1 });
borrowSchema.index({ status: 1, requestDate: -1 });
borrowSchema.index({ user_id: 1, createdAt: -1 });

// Virtual fields
borrowSchema.virtual("isOverdue").get(function () {
  return (
    ["approved", "borrowed", "renewed"].includes(this.status) && // Changed from "issued" to "borrowed"
    this.dueDate &&
    this.dueDate < new Date()
  );
});

borrowSchema.virtual("daysOverdue").get(function () {
  if (!this.isOverdue) return 0;
  return Math.ceil((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
});

borrowSchema.virtual("canBeRenewed").get(function () {
  return this.status === "approved" && this.renewCount < 3 && !this.isOverdue;
});

borrowSchema.virtual("borrowDuration").get(function () {
  if (!this.issueDate || !this.returnDate) return null;
  return Math.ceil((this.returnDate - this.issueDate) / (1000 * 60 * 60 * 24));
});

// Instance methods
borrowSchema.methods.calculateFine = function (finePerDay = 5) {
  if (
    !["approved", "issued", "renewed"].includes(this.status) ||
    !this.dueDate
  ) {
    return 0;
  }

  const today = new Date();
  if (today <= this.dueDate) return 0;

  const overdueDays = Math.ceil((today - this.dueDate) / (1000 * 60 * 60 * 24));
  return overdueDays * finePerDay;
};

borrowSchema.methods.calculateCurrentFine = function (finePerDay = 5) {
  if (this.status === "returned" && this.returnDate && this.dueDate) {
    if (this.returnDate > this.dueDate) {
      const overdueDays = Math.ceil(
        (this.returnDate - this.dueDate) / (1000 * 60 * 60 * 24)
      );
      return overdueDays * finePerDay;
    }
    return 0;
  }
  return this.calculateFine(finePerDay);
};

borrowSchema.methods.canRenew = function () {
  return this.status === "approved" && this.renewCount < 3 && !this.isOverdue;
};

borrowSchema.methods.renew = function (additionalDays = 14) {
  if (!this.canRenew()) {
    throw new Error("Cannot renew this borrow");
  }

  this.renewCount += 1;
  this.dueDate = new Date(
    this.dueDate.getTime() + additionalDays * 24 * 60 * 60 * 1000
  );
  this.status = "renewed";
  return this.save();
};

// FIXED: Static methods with correct field names
borrowSchema.statics.findOverdue = function () {
  return this.find({
    status: { $in: ["approved", "borrowed", "renewed"] }, // Changed from "issued" to "borrowed"
    dueDate: { $lt: new Date() },
  });
};

borrowSchema.statics.findByUser = function (userId) {
  return this.find({ user_id: userId }).populate("book_id", "title author");
};

borrowSchema.statics.findActiveByUser = function (userId) {
  return this.find({
    user_id: userId,
    status: { $in: ["requested", "approved", "issued", "renewed"] },
  });
};

borrowSchema.statics.findPendingRequests = function () {
  return this.find({ status: "requested" })
    .populate("user_id", "name email contact")
    .populate("book_id", "title author")
    .sort({ requestDate: 1 });
};

// Pre-save middleware
borrowSchema.pre("save", async function (next) {
  try {
    // Auto-calculate fine for returned books
    if (this.status === "returned" && this.returnDate && this.dueDate) {
      if (this.returnDate > this.dueDate) {
        const overdueDays = Math.ceil(
          (this.returnDate - this.dueDate) / (1000 * 60 * 60 * 24)
        );
        const Settings = mongoose.model("Settings");
        const settings = (await Settings.findOne()) || { finePerDay: 5 };
        this.fineAmount = overdueDays * settings.finePerDay;
        this.totalFine = this.fineAmount;
      }
    }

    // Set issue date and due date when status changes to approved
    if (this.status === "approved") {
      if (!this.issueDate) {
        this.issueDate = new Date();
      }
      if (!this.dueDate) {
        this.dueDate = new Date(
          this.issueDate.getTime() + 7 * 24 * 60 * 60 * 1000
        );
      }
    }

    const validTransitions = {
      requested: ["approved", "rejected"],
      approved: ["returned", "renewed", "renew_requested"], // added
      renew_requested: ["renewed", "returned"], // added
      renewed: ["returned", "renewed"],
      returned: [],
      rejected: [],
      issued: ["returned"],
    };

    if (this.isModified("status") && !this._skipStatusValidation) {
      const previousStatus = this._original?.status || "requested";
      const allowedStatuses = validTransitions[previousStatus] || [];

      if (
        previousStatus !== this.status &&
        !allowedStatuses.includes(this.status)
      ) {
        return next(
          new Error(
            `Invalid status transition from ${previousStatus} to ${this.status}`
          )
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Post-save middleware for logging
borrowSchema.post("save", function (doc) {
  console.log(`Borrow ${doc._id} status changed to: ${doc.status}`);
});

// Pre-init middleware to store original document
borrowSchema.pre("init", function (doc) {
  this._original = doc;
});

module.exports = mongoose.model("Borrow", borrowSchema);
