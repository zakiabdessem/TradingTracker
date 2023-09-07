require("dotenv").config();

const moment = require("moment-timezone");

const MetaStats = require("metaapi.cloud-sdk").MetaStats;
const metaStats = new MetaStats(process.env.METAAPI_AUTH_TOKEN);

const axios = require("axios");

module.exports = {
  onePhaseTracker: async function (data) {
    try {
      const response = await axios.get(
        `https://metastats-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${data.accountId}/metrics`,
        {
          headers: {
            "auth-token": `${process.env.METAAPI_AUTH_TOKEN}`,
          },
        }
      );

      const account = response.data.metrics;

      const overAllDrawdown =
        ((data.initialBalance - account.equity) / data.initialBalance) * 100;

      if (overAllDrawdown >= 12)
        return {
          account: data,
          breach: true,
          breachType: "OverAll",
          drawDown: {
            equity: account.equity,
            percentage: overAllDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      const dailyDrawdown =
        ((data.startingBalance - account.equity) / data.startingBalance) * 100;

      if (isNewDay(data.lastChecked)) {
        data.startingBalance = account.equity;
        data.lastChecked = new Date();
        await axios.post(
          `${process.env.API}/updates/newDay/${data._id}`,
          data, // Assuming `account` is a JSON object
          {
            headers: {
              Authorization: `${process.env.SECRET_TOKEN}`,
            },
          }
        );
      }

      if (dailyDrawdown >= 6)
        return {
          account: data,
          breach: true,
          breachType: "Daily",
          drawDown: {
            equity: account.equity,
            percentage: dailyDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      switch (data.challengeType) {
        case "one-phase":
          return {
            account: data,
            breach: false,
            breachType: null,
            profitTarget:
              account.balance >=
              data.initialBalance * 0.09 + data.initialBalance,
            drawDown: null,
            error: false,
          };

        case "two-phase":
          return {
            account: data,
            breach: false,
            breachType: null,
            profitTarget:
              account.balance >=
              data.initialBalance * 0.08 + data.initialBalance,
            drawDown: null,
            error: false,
          };
      }
    } catch (e) {
      //console.log(e);
      return { account: data, error: true };
    }
  },
  twoPhaseTracker: async function (data) {
    try {
      const response = await axios.get(
        `https://metastats-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${data.accountId}/metrics`,
        {
          headers: {
            "auth-token": `${process.env.METAAPI_AUTH_TOKEN}`,
          },
        }
      );

      const account = response.data.metrics;

      const overAllDrawdown =
        ((data.initialBalance - account.equity) / data.initialBalance) * 100;

      if (overAllDrawdown >= 12)
        return {
          account: data,
          breach: true,
          breachType: "OverAll",
          drawDown: {
            equity: account.equity,
            percentage: overAllDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      const dailyDrawdown =
        ((data.startingBalance - account.equity) / data.startingBalance) * 100;

      if (isNewDay(data.lastChecked)) {
        data.startingBalance = account.equity;
        data.lastChecked = new Date();
        await axios.post(
          `${process.env.API}/updates/newDay/${data._id}`,
          data, // Assuming `account` is a JSON object
          {
            headers: {
              Authorization: `${process.env.SECRET_TOKEN}`,
            },
          }
        );
      }

      if (dailyDrawdown >= 6)
        return {
          account: data,

          breach: true,
          breachType: "Daily",
          drawDown: {
            equity: account.equity,
            percentage: dailyDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      return {
        account: data,
        breach: false,
        breachType: null,
        profitTarget:
          account.balance >= data.initialBalance * 0.05 + data.initialBalance,
        drawDown: null,
        error: false,
      };
    } catch (e) {
      //console.log(e);
      return { account: data, error: true };
    }
  },
  fundedTracker: async function ({ data, type }) {
    try {
      const response = await axios.get(
        `https://metastats-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${data.accountId}/metrics`,
        {
          headers: {
            "auth-token": `${process.env.METAAPI_AUTH_TOKEN}`,
          },
        }
      );

      const account = response.data.metrics;
      const overAllDrawdown =
        ((data.initialBalance - account.equity) / data.initialBalance) * 100;

      if (overAllDrawdown >= 12)
        return {
          account: data,
          breach: true,
          breachType: "OverAll",
          drawDown: {
            equity: account.equity,
            percentage: overAllDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      const dailyDrawdown =
        ((data.startingBalance - account.equity) / data.startingBalance) * 100;

      if (isNewDay(data.lastChecked)) {
        data.startingBalance = account.equity;
        data.lastChecked = new Date();
        await axios.post(
          `${process.env.API}/updates/newDay/${data._id}`,
          data, // Assuming `account` is a JSON object
          {
            headers: {
              Authorization: `${process.env.SECRET_TOKEN}`,
            },
          }
        );
      }

      if (dailyDrawdown >= 6)
        return {
          account: data,
          breach: true,
          breachType: "Daily",
          drawDown: {
            equity: account.equity,
            percentage: dailyDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      return {
        account: data,
        breach: false,
        breachType: null,
        drawDown: null,
        error: false,
      };
    } catch (e) {
      console.log(e);
      return { account: data, error: true };
    }
  },
  dataHandler: async function (data) {
    const { account, breach, breachType, drawDown, profitTarget, error } = data;
    if (!error && (breach || profitTarget))
      try {
        if (breach)
          await fetch(
            `${process.env.API}/updates/breach/${account._id}?type=${breachType}&equity=${drawDown.equity}&percentage=${drawDown.percentage}`,
            {
              method: "GET",
              headers: {
                Authorization: process.env.SECRET_TOKEN,
              },
            }
          );

        if (profitTarget)
          await fetch(
            `${process.env.API}/updates/profitTarget/${account._id}`,
            {
              method: "GET",
              headers: {
                Authorization: process.env.SECRET_TOKEN,
              },
            }
          );
      } catch (e) {
        //console.log(e);
      }
  },
};

function isNewDay(lastCheckedDate) {
  // Convert the current time to ET
  const currentET = moment().tz("America/New_York");

  // Get the current day at 5pm ET
  const resetET = moment().tz("America/New_York").hour(17).minute(0).second(0);

  // If current time is before 5pm ET, consider the reset time as 5pm of the previous day
  if (currentET.isBefore(resetET)) {
    resetET.subtract(1, "days");
  }

  // Convert lastCheckedDate to ET
  const lastCheckedET = moment(lastCheckedDate).tz("America/New_York");

  return lastCheckedET.isBefore(resetET);
}
