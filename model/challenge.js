const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ChallengeSchema = new Schema(
  {
    challengeType: {
      type: String,
      enum: ["one-phase", "two-phase", "funded"],
      required: true,
    },
    order: { type: mongoose.Types.ObjectId, ref: "Order" },
    credentials: {
      investorPassword: { type: String, required: false },
      login: { type: String, required: false },
      password: { type: String, required: false },
      serverName: { type: String, required: false },
    },
    status: {
      type: String,
      enum: ["in-progress", "failed", "passed", "whitelist", "disabled"],
      default: "in-progress",
    },
    accountId: { type: String, required: false },
    accountType: {
      type: String,
      enum: ["one-phase", "two-phase", "funded"],
      default: "one-phase",
    },
    withdrawls: [{ type: mongoose.Types.ObjectId, ref: "Withdraw" }],
    initialBalance: Number,
    startingBalance: Number,
    lastChecked: Date,
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

module.exports = mongoose.model("Challenge", ChallengeSchema);
