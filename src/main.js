import "./styles.css";
import { loadIdentity } from "./core/identity.js";

const app = document.getElementById("app");

const shell = document.createElement("main");
shell.className = "rb-shell";

const hero = document.createElement("section");
hero.className = "rb-hero";

const kicker = document.createElement("p");
kicker.className = "rb-kicker";
kicker.textContent = "One connected universe";

const title = document.createElement("h1");
title.className = "rb-title";
title.textContent = "Rich Bizness Universe";

const copy = document.createElement("p");
copy.className = "rb-copy";
copy.textContent = "Checking Supabase connection.";

hero.append(kicker, title, copy);
shell.append(hero);
app.append(shell);

loadIdentity()
  .then((identity) => {
    copy.textContent = identity.signedIn
      ? "Supabase connected. Signed-in identity found."
      : "Supabase connected. No signed-in user yet.";
  })
  .catch(() => {
    copy.textContent = "Clean app deployed. Add Vercel Supabase env variables to finish connection.";
  });
