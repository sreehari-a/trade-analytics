require("dotenv").config();
const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const { convertToDateString } = require("./utils");
const { PDFParse } = require("pdf-parse");

function extractNSEFNO(text) {
  const pattern =
    /NSEFNO-NCL\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)/;

  const match = text.match(pattern);

  if (!match) {
    return { error: "NSE FNO line not matched" };
  }

  return {
    payin_payout_obligation: parseFloat(match[8]),
    final_net: parseFloat(match[7]),
    net_brokerage: parseFloat(match[10]),
  };
}

async function processAccount(
  account,
  startDate = "01-Apr-2024",
  endDate = Date.now()
) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: account.email,
      password: account.password,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    function openInbox() {
      return new Promise((resolve, reject) => {
        imap.openBox("INBOX", false, (err, box) => {
          if (err) reject(err);
          else resolve(box);
        });
      });
    }

    const searchMail = async (dateSince, subjectSearch, account) => {
      return new Promise((resolve, reject) => {
        imap.search(
          [
            ["SINCE", dateSince.toISOString().slice(0, 10)],
            ["SUBJECT", subjectSearch],
          ],
          (err, results) => {
            if (err) return reject(err);
            if (!results.length) {
              resolve();
            }
            resolve(results);
          }
        );
      });
    };

    const getPDFText = async (attachment) => {
      const pdfBuffer = attachment.content;
      try {
        const parser = new PDFParse({
          data: pdfBuffer,
          password: account.pdfPassword,
        });
        console.log("PDF password used:", account.pdfPassword, account);
        const pdfText = await parser.getText();
        return pdfText.text;
      } catch (error) {
        console.log("Error in password fetch");
      }
    };

    const parseData = async (results) => {
      try {
        return new Promise((resolve, reject) => {
          const f = imap.fetch(results, { bodies: "", struct: true });
          f.on("message", (msg) => {
            msg.on("body", (stream) => {
              simpleParser(stream, async (err, parsed) => {
                const attachments = parsed.attachments || [];
                for (const attachment of attachments) {
                  if (attachment.filename.toLowerCase().endsWith(".pdf")) {
                    const pdfText = await getPDFText(attachment);
                    const values = extractNSEFNO(pdfText);
                    resolve(values);
                  }
                }
              });
            });
          });
        });
      } catch (error) {
        console.log("Error in parsepdf", results);
      }
    };

    imap.once("ready", async () => {
      try {
        await openInbox();
        let formattedDate = new Date(startDate);

        const combinedData = [];
        console.log("formattedDate", formattedDate, Date.now());
        while (formattedDate.getTime() < endDate) {
          const formattedDateForSubject = formattedDate
            .toLocaleDateString("en-GB")
            .split("/")
            .join("-");
          const dateSince = new Date(formattedDate.toISOString());
          dateSince.setDate(dateSince.getDate() - 1);
          const subjectSearch = `Combined Contract Note for ${account.accountId} ${formattedDateForSubject}`;
          const results = await searchMail(dateSince, subjectSearch, account);
          if (results && results.length > 0) {
            const data = await parseData(results);

            combinedData.push({
              ...data,
              date: convertToDateString(formattedDate),
            });
            console.log(formattedDateForSubject, "data", data);
          } else console.log(formattedDateForSubject, "data", null);
          formattedDate.setDate(formattedDate.getDate() + 1);
        }
        resolve(combinedData);
      } catch (err) {
        console.log("Error", err);
      } finally {
        imap.end();
      }
    });

    imap.once("error", (err) => {
      console.error(`❌ IMAP error for ${account.email}: ${err.message}`);
      reject(err);
    });

    imap.connect();
  });
}

async function getAccountsData(startDate, endDate) {
  // 📦 Parse from .env
  const emails = process.env.EMAILS.split(",");
  const passwords = process.env.PASSWORDS.split(",");
  const accountIds = process.env.ACCOUNT_IDS.split(",");
  const pdfPasswords = process.env.PDF_PASSWORDS.split(",");

  // 🧪 Sanity check
  if (
    emails.length !== passwords.length ||
    emails.length !== accountIds.length
  ) {
    throw new Error(
      "EMAILS, PASSWORDS, and ACCOUNT_IDS must be of the same length in .env"
    );
  }

  const accounts = emails.map((email, i) => ({
    email,
    password: passwords[i],
    accountId: accountIds[i],
    pdfPassword: pdfPasswords[i],
  }));
  for (const acc of accounts) {
    try {
      console.log(`Processing account: ${acc.email}`, accounts);
      const values = await processAccount(acc, startDate, endDate);
      return values;
    } catch (err) {
      console.error(`⚠️ Failed for ${acc.email}: ${err.message}`);
    }
  }
}

module.exports = {
  getAccountsData,
};
