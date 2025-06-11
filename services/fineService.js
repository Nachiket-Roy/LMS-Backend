const Borrow = require("../models/Borrow");
const Fine = require("../models/Fine");

const performOverdueFineUpdate = async () => {
  const overdueBorrows = await Borrow.find({
    dueDate: { $lt: new Date() },
    status: { $in: ["approved", "borrowed", "renewed"] },
  }).populate("user_id book_id");

  let updated = 0;

  for (const borrow of overdueBorrows) {
    const daysOverdue = Math.floor(
      (new Date() - new Date(borrow.dueDate)) / (1000 * 60 * 60 * 24)
    );
    const fineAmount = daysOverdue * 5;

    await Fine.findOneAndUpdate(
      { borrow_id: borrow._id },
      {
        user_id: borrow.user_id._id,
        borrow_id: borrow._id,
        book_id: borrow.book_id._id,
        amount: fineAmount,
        daysOverdue,
        status: "unpaid",
      },
      { upsert: true, new: true }
    );

    updated++;
  }

  return updated;
};

module.exports = { performOverdueFineUpdate };
