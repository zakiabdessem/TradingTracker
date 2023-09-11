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
const _ = require("lodash");

// Import your Challenge model
const Challenge = require("./model/challenge");

const RiskManagement = require("metaapi.cloud-sdk").RiskManagement;
const EquityBalanceListener =
  require("metaapi.cloud-sdk").EquityBalanceListener;

const riskManagement = new RiskManagement(process.env.METAAPI_AUTH_TOKEN);
const riskManagementApi = riskManagement.riskManagementApi;

class ExampleEquityBalanceListener extends EquityBalanceListener {
  constructor(accountId) {
    super(accountId);
    this.triggerWorker = _.debounce(this.runWorker.bind(this), 5000); // bind this to runWorker
  }

  setListenerId(id) {
    this.listenerId = id;
  }

  async onEquityOrBalanceUpdated(equityBalanceData) {
    if (!this.listenerId) return;  // If there's no listenerId, then don't process
    this.triggerWorker(equityBalanceData);
  }

  async onConnected() {
    //console.log("on connected event received");
  }

  async onDisconnected() {
    // console.log("on disconnected event received");
  }

  async runWorker(equityBalanceData) {
    try {
      //fetch account from DB
      const account = await Challenge.findOne({
        accountId: this.accountId,
      })
        .select(
          "_id challengeType accountType initialBalance startingBalance lastChecked"
        )
        .lean()
        .exec();

      const result = await piscina.run(
        {
          account: { ...account, _id: account._id.toString() },
          equityBalanceData,
        },
        {
          name:
            account.accountType == "one-phase"
              ? "onePhaseTracker"
              : account.accountType == "two-phase"
              ? "twoPhaseTracker"
              : "fundedTracker",
        }
      );
      if (!result.error && (result.breach || result.profitTarget)) {
        piscina.run(result, {
          name: "dataHandler",
        });

        // Assuming riskManagementApi.removeEquityBalanceListener properly stops the listener based on listenerId.
        riskManagementApi.removeEquityBalanceListener(this.listenerId);

        // Since we're stopping using the listenerId, we can delete the listenerId to signify the listener is no longer active.
        delete this.listenerId;
      }
    } catch (e) {
      console.log(e);
    }
  }
}


app.get("/startListener/:accountId", async (req, res) => {
  try {
    const accountId = req.params.accountId;
    const equityBalanceListener = new ExampleEquityBalanceListener(accountId);
    const listenerId = await riskManagementApi.addEquityBalanceListener(
      equityBalanceListener,
      accountId
    );

    // Store the listenerId if you want to stop it later
    // You can store it in a map or in your database

    res.send({ success: true, message: "Started listener" });
  } catch (err) {
    res.send({ success: false, message: err.message });
  }
});

async function getStoredAccountIds() {
  try {
    const accounts = await Challenge.find({
      status: "in-progress",
    })
      .select("accountId")
      .lean()
      .exec();

    // Extracting accountIds from the challenges
    const accountIds = accounts.map((challenge) => challenge.accountId);
    return accountIds;
  } catch (error) {
    console.error("Error fetching account IDs:", error);
    throw error; // or return an empty array or handle this error as per your requirement
  }
}

async function startAllListeners() {
  // Fetch all account IDs from your database
  const accountIds = await getStoredAccountIds();

  for (let accountId of accountIds) {
    if (!accountId) {
      console.error("Undefined accountId found, skipping...");
      continue;
    }
    try {
      const equityBalanceListener = new ExampleEquityBalanceListener(accountId);
      const listenerId = await riskManagementApi.addEquityBalanceListener(
        equityBalanceListener,
        accountId
      );

      equityBalanceListener.setListenerId(listenerId);

      // Store the listenerId if you want to stop it later
      // You can store it in a map or in your database
    } catch (err) {
      console.error("Failed to start listener for account", err);
    }
  }
}

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
      startAllListeners();
    });
  })
  .catch((err) => console.error(err));
