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

const RiskManagement = require("metaapi.cloud-sdk").RiskManagement;
const EquityBalanceListener =
  require("metaapi.cloud-sdk").EquityBalanceListener;

const riskManagement = new RiskManagement(process.env.METAAPI_AUTH_TOKEN);
const riskManagementApi = riskManagement.riskManagementApi;

class ExampleEquityBalanceListener extends EquityBalanceListener {
  constructor(accountId) {
    super(accountId);
    this.triggerWorker = _.debounce(this.runWorker, 30000);
  }

  async onEquityOrBalanceUpdated(equityBalanceData) {
   // console.log("equity balance update received", equityBalanceData);
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
      if (!result.error && (result.breach || result.profitTarget))

      piscina.run(result, {
        name: "dataHandler",
      });
    } catch (e) {
      console.log(e);
    }
    // Your worker logic here, this function will only be called once every 5 seconds at most
    // Even if onEquityOrBalanceUpdated gets called multiple times in quick succession
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
