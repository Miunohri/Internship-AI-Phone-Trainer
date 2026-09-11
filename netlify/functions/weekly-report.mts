import {
  formatWeeklyReportForGoogleChat,
} from "../../src/lib/reports/weeklyReport";
import {
  generatePreviousWeekReport,
} from "../../src/lib/reports/weeklyReportService";
import {
  sendGoogleChatMessage,
} from "../../src/lib/reports/googleChat";
import {
  getWeeklyReportSettings,
} from "../../src/lib/reports/weeklyReportSettings";

const REPORT_TIME_ZONE = "America/New_York";
const REPORT_HOUR = 9;

function getLocalHour(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });

  const hourPart = formatter
    .formatToParts(date)
    .find((part) => part.type === "hour");

  return Number(hourPart?.value);
}

const weeklyReport = async () => {
  const now = new Date();
  const localHour = getLocalHour(now, REPORT_TIME_ZONE);

  // Netlify schedules in UTC. The function runs at both possible
  // UTC equivalents of 9:00 a.m. Eastern and sends only at the
  // invocation that is actually 9:00 a.m. in New York.
  if (localHour !== REPORT_HOUR) {
    console.log(
      `Skipping weekly report: local hour in ${REPORT_TIME_ZONE} is ${localHour}.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        reason: "Not 9:00 a.m. Eastern",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const settings = await getWeeklyReportSettings();

    if (!settings.enabled) {
      console.log(
        "Skipping weekly report: automatic reports are disabled."
      );

      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "Automatic weekly reports are disabled",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const report = await generatePreviousWeekReport(now);
    const message = formatWeeklyReportForGoogleChat(report);
    const googleChatResponse = await sendGoogleChatMessage(message);

    console.log(`Weekly report sent for ${report.period.label}.`);

    return new Response(
      JSON.stringify({
        success: true,
        skipped: false,
        period: report.period,
        googleChatResponse,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Netlify weekly report failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Weekly report failed",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};

export default weeklyReport;

export const config = {
  schedule: "0 13,14 * * 1",
};