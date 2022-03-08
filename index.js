const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Telegraf } = require("telegraf");

const token = ""; // TELEGRAM BOT TOKEN
const serviceAccount = {}; // FIREBASE SERVICE ACCOUNT
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://EXAMPLE.europe-west1.firebasedatabase.app", // YOUR FIREBASE DATABASE URL
});

const dateObj = new Date();
const month = dateObj.getUTCMonth() + 1; //months from 1-12
const day = dateObj.getUTCDate();
const year = dateObj.getUTCFullYear();
const newdate = day + "-" + month + "-" + year;

const db = admin.database();
const bot = new Telegraf(token, {
  telegram: { webhookReply: true },
});

// error handling
bot.catch((err, ctx) => {
  functions.logger.error("[Bot] Error", err);
  return ctx.reply(`Опа, ошибочка: ${ctx.updateType}. Перешли ее @idnzg`, {
    reply_markup,
    err,
  });
});

// initialize the commands
bot.command("/start", (ctx) => {
  ctx.reply(
    "Привет! Отмечай когда ты в офисе, а когда уходишь из него, и Вадим будет доволен.",
    { reply_markup }
  );
});

bot.command("soon", async (ctx) => {
  ctx.reply("Какие интенции?", reply_markup);
});

bot.command("here", async (ctx) => {
  await hereTg(ctx);
});

bot.command("status", async (ctx) => {
  await statusTg(ctx);
});

bot.command("left", async (ctx) => {
  await leftTg(ctx);
});

bot.on("sticker", (ctx) => {
  console.log(ctx.message.from.id);
});

// copy every message and send to the user
const msgs = [
  "До 12:00 приду 🥺",
  "До трех максимум, бро! 🦾",
  "Дай бог до 6 пригоню 🤡",
];

const statuses = ["Кто в офисе? 😳", "Я в офисе 😎", "Ушел"];
const todayNo = ["Сегодня не приду"];

const reply_markup = {
  keyboard: [msgs, todayNo, statuses],
};

async function statusTg(ctx) {
  let v = [];
  await db
    .ref(newdate)
    .once("value", async function (snapshot) {
      const va = await snapshot.val();
      if (va) {
        v = va;
      }
    })
    .catch(async (err) => {
      return false;
    });

  const val = Object.values(v);

  let ppl = val.map((human) => {
    return human.name;
  });
  console.log(ppl);
  const humans = (number) => {
    const titles = ["человек", "человека", "человек"];
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[
      number % 100 > 4 && number % 100 < 20
        ? 2
        : cases[number % 10 < 5 ? number % 10 : 5]
    ];
  };

  let soons = [];

  await db.ref("soon/" + newdate).once("value", async function (snapshot) {
    const v = await snapshot.val();
    if (v) {
      const val = Object.values(v);
      soons = val.map((son) => {
        return son.name + ": " + son.text;
      });
    }
  });

  const nowinoffice =
    val.length > 0
      ? "Сейчас в офисе " +
        val.length +
        " " +
        humans(val.length) +
        ": " +
        ppl.join(", ") +
        "."
      : "Походу, никого нет.";

  const msg =
    soons.length > 0
      ? nowinoffice + "\n\nТенденции вот такие:\n" + soons.join("\n")
      : nowinoffice;

  await ctx.reply(msg, { reply_markup });
}

async function hereTg(ctx) {
  console.log(newdate, ctx.message.from.id);
  await db
    .ref(newdate + "/" + ctx.message.from.id)
    .set({
      name: ctx.from.first_name,
    })
    .then(async (res) => {
      await ctx.reply("Принял", { reply_markup });
      db.ref("soon/" + newdate + "/" + ctx.message.from.id).remove();
    });
}

async function leftTg(ctx, no) {
  await db
    .ref(newdate + "/" + ctx.message.from.id)
    .remove()
    .then(async (res) => {
      if (!no) {
        await ctx.reply("Понял", { reply_markup });
      }
    });
}

function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

bot.on("message", async (ctx) => {
  const text = ctx.message.text;

  if (msgs.includes(text)) {
    await db
      .ref("soon/" + newdate + "/" + ctx.message.from.id)
      .set({
        name: ctx.from.first_name,
        text: ctx.message.text,
      })
      .then(async (res) => {
        leftTg(ctx, true);
        const randnum = getRndInteger(0, 4);
        const phrases = {
          1: "Ок",
          2: "Бро, это не круто. Это вообще не газ.",
        };

        if (randnum === 0 || randnum === 1) {
          ctx.replyWithVoice("https://extensi.one/file.ogg", {
            duration: 2000,
            reply_markup,
          });
        } else if (randnum === 1 || randnum === 2) {
          ctx.reply(phrases[randnum], {
            reply_markup,
          });
        } else {
          ctx.replyWithSticker(
            "CAACAgIAAxkBAAOkYg5dSegLzSawJkfTFVKx-Lu0-_0AAqQNAALJvJhLbyl0GElA8_IjBA",
            {
              reply_markup,
            }
          );
        }
      });
  } else if (statuses.includes(text)) {
    if (text === statuses[0]) {
      await statusTg(ctx);
    } else if (text === statuses[1]) {
      await hereTg(ctx);
    } else if (text === statuses[2]) {
      await leftTg(ctx);
    }
  } else if (text === todayNo[0]) {
    await db
      .ref("soon/" + newdate + "/" + ctx.message.from.id)
      .set({
        name: ctx.from.first_name,
        text: ctx.message.text,
      })
      .then(async (res) => {
        leftTg(ctx, true);
        ctx.reply("Мне нечего добавить! До завтра!", {
          reply_markup,
        });
      });
  }
});

exports.echoBot = functions.https.onRequest(async (request, response) => {
  functions.logger.log("Incoming message", request.body);
  return await bot.handleUpdate(request.body, response).then((rv) => {});
});
