require("dotenv").config();

const moment = require("moment-timezone");

const MetaStats = require("metaapi.cloud-sdk").MetaStats;
const metaStats = new MetaStats(process.env.METAAPI_AUTH_TOKEN);

const axios = require("axios");

module.exports = {
  onePhaseTracker: async function ({ account, equityBalanceData }) {
    try {
      const overAllDrawdown =
        ((account.initialBalance - equityBalanceData.equity) /
          account.initialBalance) *
        100;

      if (overAllDrawdown >= 12)
        return {
          account,
          breach: true,
          breachType: "OverAll",
          drawDown: {
            equity: equityBalanceData.equity,
            percentage: overAllDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      const dailyDrawdown =
        ((account.startingBalance - equityBalanceData.equity) /
          account.startingBalance) *
        100;

      if (isNewDay(account.lastChecked)) {
        account.startingBalance = equityBalanceData.equity;
        account.lastChecked = new Date();
        await axios.post(
          `${process.env.API}/updates/newDay/${account._id}`,
          account, // Assuming `account` is a JSON object
          {
            headers: {
              Authorization: `${process.env.SECRET_TOKEN}`,
            },
          }
        );
      }

      if (dailyDrawdown >= 6)
        return {
          account,
          breach: true,
          breachType: "Daily",
          drawDown: {
            equity: equityBalanceData.equity,
            percentage: dailyDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      switch (account.challengeType) {
        case "one-phase":
          return {
            account,
            breach: false,
            breachType: null,
            profitTarget:
              equityBalanceData.balance >=
              account.initialBalance * 0.09 + account.initialBalance,
            drawDown: null,
            error: false,
          };

        case "two-phase":
          return {
            account,
            breach: false,
            breachType: null,
            profitTarget:
              equityBalanceData.balance >=
              account.initialBalance * 0.08 + account.initialBalance,
            drawDown: null,
            error: false,
          };
      }
    } catch (e) {
      //console.log(e);
      return { account, error: true };
    }
  },
  twoPhaseTracker: async function ({ account, equityBalanceData }) {
    try {
      const overAllDrawdown =
        ((account.initialBalance - equityBalanceData.equity) /
          account.initialBalance) *
        100;

      if (overAllDrawdown >= 12)
        return {
          account,
          breach: true,
          breachType: "OverAll",
          drawDown: {
            equity: equityBalanceData.equity,
            percentage: overAllDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      const dailyDrawdown =
        ((account.startingBalance - equityBalanceData.equity) /
          account.startingBalance) *
        100;

      if (isNewDay(account.lastChecked)) {
        account.startingBalance = equityBalanceData.equity;
        account.lastChecked = new Date();
        await axios.post(
          `${process.env.API}/updates/newDay/${account._id}`,
          account, // Assuming `account` is a JSON object
          {
            headers: {
              Authorization: `${process.env.SECRET_TOKEN}`,
            },
          }
        );
      }

      if (dailyDrawdown >= 6)
        return {
          account,
          breach: true,
          breachType: "Daily",
          drawDown: {
            equity: equityBalanceData.equity,
            percentage: dailyDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      return {
        account,
        breach: false,
        breachType: null,
        profitTarget:
          equityBalanceData.balance >=
          account.initialBalance * 0.05 + account.initialBalance,
        drawDown: null,
        error: false,
      };
    } catch (e) {
      //console.log(e);
      return { account, error: true };
    }
  },
  fundedTracker: async function ({ account, equityBalanceData }) {
    try {
      const overAllDrawdown =
        ((account.initialBalance - equityBalanceData.equity) /
          account.initialBalance) *
        100;

      if (overAllDrawdown >= 12)
        return {
          account: account,
          breach: true,
          breachType: "OverAll",
          drawDown: {
            equity: equityBalanceData.equity,
            percentage: overAllDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      const dailyDrawdown =
        ((account.startingBalance - equityBalanceData.equity) /
          account.startingBalance) *
        100;

      if (isNewDay(account.lastChecked)) {
        account.startingBalance = equityBalanceData.equity;
        account.lastChecked = new Date();
        await axios.post(
          `${process.env.API}/updates/newDay/${account._id}`,
          account, // Assuming `account` is a JSON object
          {
            headers: {
              Authorization: `${process.env.SECRET_TOKEN}`,
            },
          }
        );
      }

      if (dailyDrawdown >= 6)
        return {
          account: account,
          breach: true,
          breachType: "Daily",
          drawDown: {
            equity: equityBalanceData.equity,
            percentage: dailyDrawdown,
          },
          profitTarget: false,
          error: false,
        };

      return {
        account: account,
        breach: false,
        breachType: null,
        drawDown: null,
        error: false,
      };
    } catch (e) {
      console.log(e);
      return { account: account, error: true };
    }
  },
  dataHandler: async function (data) {
    const { account, breach, breachType, drawDown, profitTarget } = data;
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
