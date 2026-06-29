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
copy.textContent = "Clean app shell is live. GitHub and Vercel are connected. Supabase wiring is next.";

hero.append(kicker, title, copy);
shell.append(hero);
app.append(shell);
