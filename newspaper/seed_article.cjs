const fs = require("fs");
const http = require("http");

const articleData = {
  title: "A Symphony of Masa and Memory: Action Bronson’s Transcendent New York Taco Trail",
  byline: "By Shaka Selah",
  category: "Arts",
  api_key: "shaka-key",
  author_promotion:
    "Join the correspondence below to discuss the cultural impact of NYC's culinary grit.",
  content: `[EMBED YOUTUBE: https://www.youtube.com/watch?v=YerpiAc2sCI]

In the ceaseless, chaotic theater of New York City, few figures command the sensory stage quite like Action Bronson. His latest cinematic endeavor transcends the conventional food show, morphing instead into a surreal, Bourdain-esque odyssey fueled by towering highs, raw authenticity, and a profound reverence for Mexican cuisine. 

Bronson—often heralded as the heart and soul of New York—embarks on a journey that is as much an emotional rollercoaster as it is a culinary one. He navigates the city's hidden gems, from the humble, unassuming counters of Yummy Taco in Queens (a testament to the cross-cultural magic where Asian proprietors craft spectacular Mexican fare) to the elevated, artful mastery of Corima. It's a stark reminder that while border states boast their pedigree, the five boroughs harbor their own undisputed culinary titans. 

Amidst the feast, the episode is punctuated by Bronson's unhinged and deeply human moments. Whether he is profoundly "geeked as hell," attempting to decipher the phantom taste of sunflower seeds in a dish entirely devoid of them, or spontaneously quoting Korn's "Freak on a Leash" mid-meal, he remains entirely himself. A self-professed "Jedi" with his hood folded just right, he speaks the universal language of good food ("Dumb!" being the highest compliment a chef can receive). 

Yet, beneath the hazy, sitcom-like hilarity lies a deeply touching core. A poignant segment finds him reminiscing about a childhood best friend over a plate of comfort food—a testament to how a single bite can collapse time, bringing the past rushing back. 

He treats the chefs, line cooks, and viewers with a boundless, humble respect. To watch Bronson hold court in these kitchens is to witness a man becoming what he loves most: a fine wine of entertainment and culture, getting richer, weirder, and infinitely better with age.`,
};

const commentsData = [
  { author: "firstarsch2221", content: "Damn he high as FUCK in this one" },
  { author: "scamculture", content: "“Freak on a leash, that song is crazy” lmfao" },
  {
    author: "ASAPcheddar",
    content:
      'Action-"what it tastes like is when you chew a bunch of sunflower seeds"\nolvera- "But it has no sunflowers..."\nAction- "that\'s what I\'m saying"\n🤣',
  },
  {
    author: "lucadifiore8680",
    content:
      "The little segment of him reminiscing about his childhood best friend while eating comfort food was beautiful",
  },
  {
    author: "aarons.4906",
    content:
      '"Equivalent to getting head in the whip and not crashing". lol. That last restaurant looked incredible.',
  },
  {
    author: "nwnw9247",
    content:
      "That whole Yummy Taco ordering scene got me weak. bro was faded beyond belief in that one",
  },
  { author: "callumdickie1849", content: "My boy geeked as hell" },
  {
    author: "jakeethesnakee",
    content: "Nobody quite represents the heart and soul of New York quite like the Doctor himself",
  },
  { author: "YeahNo-777", content: "'I know, but am mid-swipe' 🤣" },
  { author: "soraya5409", content: "Mad happy this series is back" },
  {
    author: "cooperbrandt4286",
    content:
      "“Listen strip clubs usually have tremendous kitchens, they put a lot of work into this”- Action Bronson 2026",
  },
  {
    author: "adamq3625",
    content: "I love the way Action folds the front of his hood up. Makes him look like a lil Jedi",
  },
  { author: "roda4828", content: "We need another party supplies collab FR" },
  { author: "hotcheerros", content: "i appreciate the rage bait title" },
  {
    author: "foxfirehehexd",
    content:
      "this has got to be the most unhinged one yet, i swear to god this episode is structured and edited like a sitcom",
  },
  {
    author: "PapaJoeNRR",
    content:
      "When I met action dude was so humble he listened payed attention asked about how my mom and dad is and what not. Dudes famous and a celebrity but he's the most humble down to earth mf out here on the internet. He won't hesitate for a picture or a hand shake for a fan or friend......hes a real one yall",
  },
  { author: "SatanSupimpa", content: "Señor Action is an album name" },
  { author: "dangerapple", content: "So cal said hold my cerveza" },
  {
    author: "D_ruggs92",
    content:
      "“Corn tortillas is my favorite”\n\n10min later\n\n“Personally I like flour tortillas” lol",
  },
  { author: "curtisferrier9822", content: "Action Bourdain in the house" },
  { author: "IwakiSeiji", content: "THAT LAST PLACE EVERY DISH WAS AN ART PIECE" },
  { author: "nicholasali2182", content: "THE SUNFLOWER SEEDS MOMENT WAS AWKWARD AF. CRICKETS." },
  { author: "waterym1449", content: "Mexican cuisine heaven on earth, ecstasy to the soul🇲🇽" },
  { author: "AdlerDanEgoe", content: "God damn I'm airfying frozen nuggers for this." },
  { author: "marsz_101", content: '"Muy verga. Muy verga." 😂' },
  { author: "Chewythetruth", content: "Chicanos in LA are raging over the title." },
  { author: "JayseeYT", content: "Action still not letting Alan off with this one 💀" },
  {
    author: "LuckyxCatzxGarage",
    content: "Why does the last chef end everything in a Question? 😂",
  },
  {
    author: "jeffsimpson7258",
    content: "I should not have watched this before eating. It all looks amazing!!",
  },
  {
    author: "csandberg13",
    content: "The mere suggestion that NY beats LA or SD in this category is completely insane",
  },
  { author: "damianson", content: "Wish I could afford to eat any of this." },
  {
    author: "TheBag9707",
    content:
      "yummy taco is a hidden gem frfr asian ppl make great mexican in nyc... and ironically mexicans make great pizza in nyc too",
  },
  {
    author: "ryleesblooms",
    content: "$4 for an avocado? That’s almost as insane as saying NYC has the best Mexican food.",
  },
  {
    author: "margaritagonzalez9888",
    content:
      "Lmao 😂talking and corn then he mentions freak on a leash by Allen “that song is crazy “ I laughed too hard at that",
  },
  { author: "MarcoGin", content: "Damn now I need to get tacos for lunch" },
  {
    author: "erikcharlat9844",
    content: '@23:15 "Dumb!" probably the highest compliment you can give a Chef. love it so much',
  },
  { author: "LFJ100", content: "This episode was an emotional roller coaster" },
  {
    author: "karigrandii",
    content: "15:48 bro went from anti-bacterial to microbial in one second",
  },
  {
    author: "Anthony-h1e",
    content:
      "Action, blessings bro, I want to see if you pull-up to Sabor de mami in Tampa fl lol.",
  },
  { author: "groovylouu", content: "that Korn joke went over his head" },
  {
    author: "hiero-hiero",
    content: "Flying ants on the grill in NYC ? Welcome to HellsKitchen 😈",
  },
  { author: "llóronrecords", content: "this is beautiful" },
  { author: "StraightEdgeView", content: "Corima" },
  {
    author: "LPnWoW",
    content: "Just seen this guy on Long Island he was super chill eating at a good spot",
  },
  {
    author: "burritoguy67",
    content:
      "Action, don't stop. you are becoming what you love the most. Fine wine. Getting better and better with age.",
  },
  {
    author: "tcase101",
    content:
      "I moved to San Antonio in 2010. My life changed after experiencing all the different foods. My view on Mexican food completely changed",
  },
  {
    author: "hereszjohnny",
    content: "when is the submarino mariscos episode coming out i peeped you were there :)",
  },
  { author: "mubarakusman9184", content: '"... microbial" 😭😭 never ever change Action' },
  {
    author: "ghostyMSN",
    content: "We definetly need another Party Supplies collabs, Mr. Baklava.",
  },
  {
    author: "newyorkzgiant8477",
    content:
      "The one thing everyone slacks off from yummy taco is their grilled chicken soup. Its stupid fire... i moved to Astoria and still go back to my hood for it",
  },
  { author: "RDCCC", content: "What a series, now I’m hungry 🇲🇽🌮🎉" },
  { author: "Yuichurros", content: "11:30 Fresh Meadows represent!!!" },
  { author: "frozenoceanyoshimitsu6355", content: "Those eyeglasses are so friggin player" },
  { author: "simonbartolomeo8548", content: "That Jaromir Jagr hockey hair reference 😂" },
  {
    author: "2woxan212",
    content:
      "\"Oyé saluda\" 😂 That's so Spanish making you greet the guest, You don't even know as a Cuban kid how many times I've heard that.",
  },
  { author: "burksregime315", content: "12:49 utter confusion......high" },
  { author: "phillytech4758", content: "WE ALL WANT A NEW SUPPLIES JOINT!" },
  {
    author: "thesearmsaresnacks8899",
    content:
      "Spots like this that don’t try to be all stupid and fancy seem to stick around wayyy longer. See the connection?",
  },
  {
    author: "Greenleaffern",
    content:
      "AMAZON PRIME, NETFLIX, HBO, PARAMOUNT, any other hundred streaming companies. CUT. THE CHECK!!! Give Mr. Bronson the proper budget to create the Frankenstein of entertainment for food , fashion, music, cuisine and culture. He is carrying the torch passed down by the GOAT Bourdain. And putting his own flavor in this genre.",
  },
  { author: "bryan_gurrrero", content: "“They Mexican parmesand it” 😂 muy verga" },
  { author: "wz5u7ti2", content: "Action is high as a kite when he eats the soup! Love those guy" },
  { author: "MAFCA-USA", content: "The Corima segment looked fucking incredible" },
  {
    author: "TacoFalcon",
    content:
      "You can find bomb Mexican food in most major states/cities but you can't beat border states like California imo",
  },
  { author: "Greenmanjim", content: "Acapulco Deli in GP is fire too" },
  { author: "shanko9343", content: "YUMMY TACO won’t fail you it’s good and affordable 🔥👏🏾" },
  {
    author: "Makingthebombs570",
    content:
      "The yummy taco on Church Ave., in Brooklyn used to deliver my food. Stop at the store grab a pack of dutch’s and a bottle. GOATED",
  },
  {
    author: "humbertogorgonio4391",
    content:
      "Chef enrique talking to Action like his own son, is the most Mexican moment ever 🤣🔥🔥🔥🔥",
  },
  {
    author: "richardscott1839",
    content:
      "I just love Action. He’s so courteous to all. And just got back from Paris where me n the wife went to as many Action and Clovis spots as poss. Legend.",
  },
  {
    author: "matthewwrubel41",
    content:
      "Yummy taco reminds me of Jesus Taco that closed near my old place in Harlem. I miss that hole in the wall, shit was so good",
  },
  { author: "azoique", content: "Our favorite Glutton." },
  { author: "MitchWise86", content: "BEST FOOD SHOW OF ALL TIME" },
  {
    author: "ACMendez",
    content: "11:28 - almost spat my food out at this, action is funny as hell lmaoo",
  },
  { author: "a.rome3", content: "he definitely saw the comments on the last vid." },
  { author: "dancorn3422", content: "Don’t start saying “pause” Action" },
  { author: "Therealness8480", content: "Yummy taco on Union Tpk . Fresh meadows 🔥" },
  {
    author: "hectorcardenas9790",
    content: "You respect my heritage evertime you made a video on Mexican food!",
  },
  { author: "Bryannabg", content: "Always hyped when you post food videos 🎉🎉" },
  {
    author: "jakestrumentals78",
    content: "“i feel smarter” 🤣 adding that to the phrase bank today",
  },
  {
    author: "magi115",
    content:
      "used to hit that Yummy Taco on Union in the mid 2000's when they had their kids working there. nice family, honest business.",
  },
  { author: "kangy3213", content: "God never stop making this show" },
  {
    author: "Sunsetbeach111",
    content: "Have you been through socal.. borders mexico... San Diego, Los Angeles.. lol",
  },
  { author: "jjayyy94", content: "Oh we so back" },
  { author: "BirdDawg-l5s", content: "That last place looks so fire man" },
  { author: "bubbaspielberg1", content: "16:24 bro talks in song" },
  { author: "wesleyjazz87", content: 'Shocked he didn\'t pause on "double meat"' },
  {
    author: "jamalp95",
    content:
      "Brothers been sayin what we’ve all been thinking we need that party supplies collab asap",
  },
  { author: "yotamohayon3979", content: "Yummy taco catered my bar mitzvah🙏" },
  { author: "domeskeetz", content: "Last place looks absurdly awesome." },
  { author: "SmokeyChipOatley", content: "That last restaurant is really doing that shit" },
];

async function postArticle() {
  const req = http.request(
    {
      hostname: "localhost",
      port: 3003,
      path: "/api/articles",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", async () => {
        console.log("Article Created:", data);

        // Get the latest article ID to inject comments
        const listReq = http.request(
          {
            hostname: "localhost",
            port: 3003,
            path: "/api/articles",
            method: "GET",
          },
          (listRes) => {
            let listData = "";
            listRes.on("data", (chunk) => {
              listData += chunk;
            });
            listRes.on("end", async () => {
              const articles = JSON.parse(listData);
              const newArticleId = articles[0].id; // since it unshifts to the beginning
              console.log("New Article ID:", newArticleId);

              // Post comments
              for (let i = 0; i < commentsData.length; i++) {
                const comment = commentsData[i];
                await new Promise((resolve) => {
                  const cReq = http.request(
                    {
                      hostname: "localhost",
                      port: 3003,
                      path: "/api/articles/" + newArticleId + "/comments",
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                    },
                    (cRes) => {
                      cRes.on("data", () => {});
                      cRes.on("end", () => {
                        console.log("Inserted comment " + (i + 1) + "/" + commentsData.length);
                        resolve();
                      });
                    },
                  );
                  cReq.write(JSON.stringify(comment));
                  cReq.end();
                });
                // Just a tiny pause so they insert in somewhat reasonable order though our fake API uses sync sqlite
                await new Promise((r) => setTimeout(r, 50));
              }
              console.log("All comments inserted!");
            });
          },
        );
        listReq.end();
      });
    },
  );

  req.on("error", (e) => {
    console.error("problem with request: " + e.message);
  });

  req.write(JSON.stringify(articleData));
  req.end();
}

postArticle();
