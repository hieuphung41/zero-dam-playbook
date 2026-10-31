# Shared brief — Delta Force "Zero Dam" (CN: 零号大坝, VN: Đập Nước Zero) research, Season 11 "Reorientation"

Today is 2026-10-31. Global Season 11 "Reorientation" runs 2026-09-08 → ~2026-11-09. Only use material published
2026-09-01 or later as current; older material may be used only to explain a mechanic and must be marked "pre-S11".
The CN server uses different season names/numbers: identify which CN season overlaps Sep–Oct 2026 and say how you know.

## Goal
Learn from VIDEOS first (YouTube / Bilibili / TikTok descriptions) and then articles/forums, how good players actually
play Zero Dam in S11 on a budget: loot routes, camping/ambush spots, extraction choices, contracts, and "hay ho" spots
(hidden loot, safes, keycard rooms, tricks). Get the CONTENT of videos via their transcripts/subtitles, not just titles.

## Hard rules
- Work ONLY inside your current working directory. Do not log in anywhere, do not read browser cookies or any file
  outside this directory, do not use credentials.
- Do NOT download or execute third-party binaries or packages (no yt-dlp, no pip/npm installs). Use curl and Python 3
  standard library scripts you write yourself. Save raw downloads under ./raw/ and your scripts under ./scripts/.
- Be polite: at most ~1 request/second per host; stop on repeated 403/429.
- Never invent facts, numbers, timestamps or locations. Every claim needs a source URL (+ video timestamp mm:ss when it
  comes from a transcript) and the publish date. Mark confidence: CONFIRMED (≥2 independent sources or official),
  SINGLE, UNCERTAIN (conflicting/old).

## How to get YouTube video content without yt-dlp (hints, verify yourself)
- Search sorted by upload date: https://www.youtube.com/results?search_query=<q>&sp=CAI%253D  → parse the
  `var ytInitialData = {...};` JSON (videoRenderer: videoId, title, ownerText, publishedTimeText, lengthText).
- Exact publish date + description + caption tracks: fetch https://www.youtube.com/watch?v=<id> and parse
  `ytInitialPlayerResponse` (microformat.playerMicroformatRenderer.publishDate, videoDetails.shortDescription,
  captions.playerCaptionsTracklistRenderer.captionTracks[].baseUrl, languageCode, kind=asr for auto-captions).
- Caption baseUrl may need `&fmt=json3`. If captions come back empty (PO-token protection), try the transcript panel:
  POST https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false with the INNERTUBE context from the watch
  page (INNERTUBE_API_KEY / INNERTUBE_CONTEXT in ytcfg) and the `params` found in the page's
  engagementPanels → transcript → getTranscriptEndpoint.params. Also try `&tlang=en` for translation.
- Many videos have chapters/timestamps in the description — use them.
- Bilibili: get a buvid cookie by GET https://www.bilibili.com first (cookie jar in ./raw), then
  https://api.bilibili.com/x/web-interface/search/type?search_type=video&order=pubdate&keyword=<q> ;
  video detail https://api.bilibili.com/x/web-interface/view?bvid=<bvid> (desc, pubdate, cid);
  subtitles https://api.bilibili.com/x/player/wbi/v2?bvid=<bvid>&cid=<cid> (subtitle.subtitles[].subtitle_url —
  AI subtitles may need login; if so, use desc/chapters/top comments: https://api.bilibili.com/x/v2/reply?type=1&oid=<aid>&sort=1).

## Map vocabulary used by our planner (describe locations and routes with these names)
Spawns (14, official markers; W = west side, E = east side):
- W1 west road exit area (SW, next to fixed extract A) · W2 NW ring road · W3 NW field near the big concrete slab ·
  W4 north-east of the Barracks (军营) · W5 south-east of the Barracks by the lake · W6 inside the Cement Plant (水泥厂) ·
  W7 Pipeline construction site by the river (管道/水管铺设工地).
- E1 north of the Main Substation (主变电站/大电) · E2 south of the Small Substation (小变电站/小电) · E3 south-east road ·
  E4 east of the Main Substation · E5 east hill below the dam · E6 Visitor Center (游客中心) · E7 south of the Visitor Center.
- Known rule: each side has a "#1" pair (W4/W5 and E1/E4) with exactly one squad in one of the two; 2 more squads among
  the other 5 spots of that side. Verify for S11 and report anything different.
Extracts: A west road exit (fixed, for east spawns) · B east tunnel (fixed, for west spawns) · C east road exit (random,
Easy only) · D road shortcut south of Cement Plant (random, Easy only) · E repair passage north of Barracks (drop
backpack) · F Dam crest (weight limit <30 kg Normal/<50 kg Easy, zipline) · G River bank (paid: 10k Easy / 40k Normal) ·
H Industrial elevator (lever, global alarm).
Loot clusters: Barracks · NW field camp · Cement Plant · Pipeline site/west river bank · South water zone (S9 rework:
boat, reeds, bird nests) · Underground tunnel west→main substation · Admin West wing (行政西楼) · Admin East wing (行政东楼,
Saeed boss) · Admin outskirts (container yard 集装箱, parking, construction) · Dam interior/vault (大坝内部/金库) ·
Main Substation · Small Substation · Visitor Center · East hill · Dam crest east / maintenance station.
Keycard rooms: Substation Dormitory, West Wing Infirmary, Equipment Collection Room (East 1F), Cement Plant Office,
Cement Plant Dormitory 201, Barracks Storage Room, Central VIP Room (Visitor 2F), Ticket Office (Visitor 1F),
West Wing Monitoring Room, West Wing Control Room, Substation Tech Room, East Wing Manager's Office, Underground passage.

## Questions we most need answered (S11, Easy = CN 常规, Normal = CN 机密)
1. In-raid contracts (Contract pickup stations, CN 行动接取站 / 高价值接取站, VN trạm nhận nhiệm vụ / hợp đồng): what tasks,
   how long they take, Alloy (哈夫币 / hợp kim Tekniq) reward per contract in Easy vs Normal, high-value station reward,
   whether the reward is paid instantly into the in-raid wallet, and whether that wallet pays the paid extract.
2. Paid extract G: current fee in Easy/Normal in S11; any other way to pay (teammate pays? alloy looted from enemies?).
3. Weight-limit extract F: does the 30 kg include worn gear/weapon or only backpack? How players use it on budget runs.
4. Real rotations from each spawn: which roads/bridges/tunnels players take in the first 3 minutes, where #1 squads go,
   where third-party fights happen. Describe each route as an ordered list of landmarks from the vocabulary.
5. Camping/ambush spots in S11 (exact building/floor/rock/bridge), including extraction camping, and counters.
6. Gold/red loot spots and "hay ho" tricks in S11 (hidden spots, safes, which keycard rooms are worth it, Raven's Deal,
   fishing, bird nests, events), with exact positions.
7. Budget/knife-run (跑刀 / chạy dao) meta for Zero Dam in S11: kit, operator, route, expected profit per run.

## Output (write both files in your working directory)
- report.md — sections: Sources (table: url, platform, language, channel/author, publish date, S11? yes/no, how the
  content was obtained: transcript/description/article) · Findings per question 1–7 (bullets, each with source URL,
  timestamp, date, confidence) · Routes (ordered landmark lists per spawn) · Camping spots · Loot/tricks ·
  Contradictions & gaps. Aim for at least 15 video sources with transcripts or chapter text if they exist.
- findings.json — array of {topic, claim, locations:[landmark names], route:[ordered landmarks] (optional),
  source_url, timestamp, publish_date, language, confidence}.
Finish with a short summary of what you could NOT obtain and why.
