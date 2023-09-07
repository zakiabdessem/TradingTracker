require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const Piscina = require("piscina");
const { createServer } = require("http");

const piscina = new Piscina({
  filename: `${__dirname}/worker.js`,
});

// Initialize Express
const app = express();
const httpServer = createServer(app);
const cron = require("node-cron");

// Import your Challenge model
const Challenge = require("./model/challenge");

// RESTful route to trigger account checks
app.get("/checkAllAccounts", async (req, res) => {
  try {
    const accountsOnePhase = await Challenge.find({
      accountType: "one-phase",
      status: "in-progress",
    })
      .select("-credentials -withdrawls -order")
      .lean()
      .exec();
    const accountsTwoPhase = await Challenge.find({
      accountType: "two-phase",
      status: "in-progress",
    })
      .select("-credentials -withdrawls")
      .lean()
      .exec();
    const accountsFunded = await Challenge.find({
      accountType: "funded",
      status: "in-progress",
    })
      .select("-credentials -withdrawls")
      .lean()
      .exec();

    const onePhasePromises = accountsOnePhase.map((account) => {
      return piscina.run(
        { ...account, _id: account._id.toString() },
        {
          name: "onePhaseTracker",
        }
      );
    });

    const twoPhasePromises = accountsTwoPhase.map((account) => {
      return piscina.run(
        { ...account, _id: account._id.toString() },
        {
          name: "twoPhaseTracker",
        }
      );
    });

    const fundedPromises = accountsFunded.map((account) => {
      return piscina.run(
        {
          data: { ...account, _id: account._id.toString() },
          type: "funded",
        },
        {
          name: "fundedTracker",
        }
      );
    });

    const results = await Promise.all([
      ...onePhasePromises,
      ...twoPhasePromises,
      ...fundedPromises,
    ]);

    const handleDataPromises = await Promise.all(
      results.map((data) => {
        return piscina.run(data, {
          name: "dataHandler",
        });
      })
    );

    res.json(results);
  } catch (e) {
    console.log(e);
  }
});

const checkAllAccounts = async () => {
  console.log("Checking");
  try {
    const accountsOnePhase = await Challenge.find({
      accountType: "one-phase",
      status: "in-progress",
    })
      .select("-credentials -withdrawls -order")
      .lean()
      .exec();
    const accountsTwoPhase = await Challenge.find({
      accountType: "two-phase",
      status: "in-progress",
    })
      .select("-credentials -withdrawls")
      .lean()
      .exec();
    const accountsFunded = await Challenge.find({
      accountType: "funded",
      status: "in-progress",
    })
      .select("-credentials -withdrawls")
      .lean()
      .exec();

    const onePhasePromises = accountsOnePhase.map((account) => {
      return piscina.run(
        { ...account, _id: account._id.toString() },
        {
          name: "onePhaseTracker",
        }
      );
    });

    const twoPhasePromises = accountsTwoPhase.map((account) => {
      return piscina.run(
        { ...account, _id: account._id.toString() },
        {
          name: "twoPhaseTracker",
        }
      );
    });

    const fundedPromises = accountsFunded.map((account) => {
      return piscina.run(
        {
          data: { ...account, _id: account._id.toString() },
          type: "funded",
        },
        {
          name: "fundedTracker",
        }
      );
    });

    const results = await Promise.all([
      ...onePhasePromises,
      ...twoPhasePromises,
      ...fundedPromises,
    ]);

    const handleDataPromises = await Promise.all(
      results.map((data) => {
        return piscina.run(data, {
          name: "dataHandler",
        });
      })
    );

  } catch (e) {
    console.log(e);
  }
};

cron.schedule("*/4 * * * *", async () => {
  await checkAllAccounts();
});

mongoose
  .connect(process.env.DB_CONNECT, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    keepAlive: true,
    bufferCommands: false,
  })
  .then(() => {
    httpServer.listen(process.env.PORT, () => {
      console.log(`Db connected ,listening to port ${process.env.PORT}`);
    });
  })
  .catch((err) => console.error(err));
