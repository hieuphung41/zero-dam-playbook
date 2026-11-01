/* Zero Dam planner data. Coordinates are pixels on the official 4096×4096 map (df.qq.com map tool, tiles dated 2026-09-04),
   converted to the cropped image (crop origin 900,650 → 2400×2100). Values are rough Alloy expectations for a budget run. */
(function(){
  const CROP = {x:900, y:650, w:2400, h:2100};
  const N = (x,y) => [ (x-CROP.x)/CROP.w, (y-CROP.y)/CROP.h ];
  const nodes = [];
  const add = (id,type,x,y,extra) => nodes.push(Object.assign({id,type,p:N(x,y)}, extra||{}));

  /* spawns (official marker set, 14) */
  add('s1','spawn',1051,1690,{name:'W1 · Cửa đường phía Tây', side:'W'});
  add('s2','spawn',1100,1147,{name:'W2 · Đường vành đai Tây Bắc', side:'W'});
  add('s3','spawn',1151,963,{name:'W3 · Bãi đất Tây Bắc', side:'W'});
  add('s4','spawn',1686,859,{name:'W4 · Đông Bắc Doanh trại', side:'W', pair:true});
  add('s5','spawn',1647,1060,{name:'W5 · Đông Nam Doanh trại (bờ hồ)', side:'W', pair:true});
  add('s6','spawn',1357,1442,{name:'W6 · Nhà máy xi măng', side:'W'});
  add('s7','spawn',1537,1770,{name:'W7 · Công trường ống nước', side:'W'});
  add('s8','spawn',2315,1384,{name:'E1 · Bắc Trạm biến áp chính', side:'E', pair:true});
  add('s9','spawn',2338,2099,{name:'E2 · Nam Trạm biến áp phụ', side:'E'});
  add('s10','spawn',2687,1986,{name:'E3 · Đường Đông Nam', side:'E'});
  add('s11','spawn',2679,1537,{name:'E4 · Đông Trạm biến áp chính', side:'E', pair:true});
  add('s12','spawn',2943,1410,{name:'E5 · Chân đập phía Đông', side:'E'});
  add('s13','spawn',3092,1975,{name:'E6 · Trung tâm du khách', side:'E'});
  add('s14','spawn',2910,2521,{name:'E7 · Nam Trung tâm du khách', side:'E'});

  /* extracts (official marker set, 8) */
  add('xA','extract',1069,1703,{letter:'A', name:'Cửa đường phía Tây', cond:'fixed', forSide:'E', risk:3, desc:'Cố định, luôn mở, chờ 10 s. Bị camp 2–3 phút cuối.'});
  add('xB','extract',3160,1937,{letter:'B', name:'Hầm phía Đông', cond:'fixed', forSide:'W', risk:3, desc:'Cố định, luôn mở, chờ 10 s. Bị camp 2–3 phút cuối.'});
  add('xC','extract',2820,2595,{letter:'C', name:'Cửa đường phía Đông', cond:'random', forSide:'W', risk:1, desc:'Chỉ có ở Dễ: bật/tắt ngẫu nhiên, có khói xanh là đang mở. Nam Trung tâm du khách.'});
  add('xD','extract',1278,1698,{letter:'D', name:'Lối tắt cạnh đường', cond:'random', forSide:'E', risk:1, desc:'Chỉ có ở Dễ: bật/tắt ngẫu nhiên, có khói xanh là đang mở. Nam Nhà máy xi măng.'});
  add('xE','extract',1349,778,{letter:'E', name:'Đường bảo trì', cond:'drop', forSide:'E', risk:1, desc:'Chỉ spawn bên Đông. Phải bỏ toàn bộ ba lô; đồ trong Hộp An Toàn và áo chiến thuật vẫn giữ. Trong hầm nối từ Doanh trại.'});
  add('xF','extract',3100,1218,{letter:'F', name:'Đỉnh đập', cond:'weight', forSide:'W', risk:2, desc:'Chỉ spawn bên Tây. Tổng cân nặng dưới 50 kg ở Dễ, dưới 30 kg ở Thường. Lên bằng dây zip.'});
  add('xG','extract',1920,1910,{letter:'G', name:'Bờ sông (trả phí)', cond:'paid', forSide:null, risk:1, desc:'10.000 hợp kim ở Dễ, 40.000 ở Thường. Trả bằng hợp kim kiếm trong trận (làm hợp đồng), không mang tiền vào được. Chờ 30 s, khoá sau 4 lượt.'});
  add('xH','extract',2535,808,{letter:'H', name:'Thang máy công nghiệp', cond:'lever', forSide:null, risk:4, desc:'Kéo cần ở Toà Tây 2F hoặc Trạm biến áp chính; báo động toàn map; chờ ~4 phút; Thường chỉ kéo được 1 lần.'});

  /* boss */
  add('boss','boss',2285,1158,{name:'Saeed (Fiery Owl Guard) — sảnh/cầu thang Toà Đông'});

  /* loot clusters: valueNormal / valueEasy = rough expected Alloy from one pass; risk 0–4; lootMin = minutes to clear */
  add('barracks','poi',1552,934,{name:'Doanh trại', valueNormal:175000, valueEasy:70000, risk:1, lootMin:3, loot:'kệ + bàn máy tính 1F, bàn 2F; 1 server, hồ sơ, điện tử'});
  add('westField','poi',1100,1050,{name:'Trại dã ngoại Tây Bắc', valueNormal:72000, valueEasy:28800, risk:0, lootMin:2, loot:'thùng tiếp tế dã ngoại, túi, tổ chim'});
  add('cement','poi',1471,1441,{name:'Nhà máy xi măng', valueNormal:325000, valueEasy:130000, risk:2, lootMin:4, loot:'sàn dưới bồn tròn, phòng dưới hòm súng, phòng máy tính 2F Đông Nam, vàng thỏi ở máy cổng'});
  add('pipeline','poi',1560,1740,{name:'Công trường ống nước / bờ sông Tây', valueNormal:105000, valueEasy:42000, risk:1, lootMin:3, loot:'11 tủ dụng cụ dọc sông, túi du lịch, thùng tiếp tế, tổ chim'});
  add('river','poi',1800,1900,{name:'Vùng nước phía Nam (S9)', valueNormal:90000, valueEasy:36000, risk:1, lootMin:3, loot:'thuyền (nhiên liệu, điện tử), 2 túi du lịch, tổ chim Vlindflower; hang ngầm giá trị thấp'});
  add('underground','poi',2040,1540,{name:'Đường hầm ngầm (Tây → Trạm biến áp)', valueNormal:100000, valueEasy:40000, risk:2, lootMin:3, loot:'túi, tủ dụng cụ, thùng chuyển phát; phòng thẻ Lối ngầm'});
  add('adminW','poi',2170,1050,{rush:true, name:'Toà Tây (Khu hành chính)', valueNormal:500000, valueEasy:200000, risk:4, lootMin:4, loot:'WC 2F (Rolex), bàn văn phòng, quầy nước, bàn cạnh phòng cầu dao; 3 phòng thẻ; công tắc thang máy'});
  add('adminE','poi',2310,1130,{rush:true, name:'Toà Đông (Khu hành chính)', valueNormal:520000, valueEasy:208000, risk:4, lootMin:4, loot:'văn phòng 2F, két 2F, quầy lễ tân; Manager\'s Office, Equipment Room; boss Saeed ngay dưới'});
  add('adminOut','poi',2300,960,{rush:true, name:'Vành đai Admin (container, bãi đỗ, công trường)', valueNormal:215000, valueEasy:86000, risk:3, lootMin:3, loot:'6 hầm giấu đồ, thùng tiếp tế dã ngoại, túi; chokepoint cầu cạnh bãi container'});
  add('vault','poi',2440,690,{name:'Lòng đập / kho vàng', valueNormal:350000, valueEasy:140000, risk:4, lootMin:4, loot:'20 đống xu vàng, két; chỉ mở qua nhiệm vụ Gold/Wall Breaker, có gas và guard của Saeed'});
  add('mainSub','poi',2380,1640,{name:'Trạm biến áp chính', valueNormal:360000, valueEasy:144000, risk:3, lootMin:4, loot:'3 server, két (thẻ), chốt bảo vệ cổng, phòng flight-case 2F; Tech Room (thẻ)'});
  add('smallSub','poi',2160,1862,{name:'Trạm biến áp phụ', valueNormal:160000, valueEasy:64000, risk:2, lootMin:3, loot:'két nhỏ, flight case, sàn giữa 2 máy phát, nóc thùng gỗ; phòng ký túc (thẻ rẻ nhất)'});
  add('visitor','poi',2919,2069,{name:'Trung tâm du khách', valueNormal:305000, valueEasy:122000, risk:1, lootMin:4, loot:'phòng nhỏ 2F bên phải, bar 1F, bàn máy tính 1F, bàn trà 2F, WC 1F; 4 vali cao cấp, 3 hầm giấu đồ'});
  add('eastField','poi',2860,1540,{name:'Đồi phía Đông', valueNormal:60000, valueEasy:24000, risk:1, lootMin:2, loot:'thùng tiếp tế, tổ chim, túi; đường rotation E4↔E5'});
  add('damTopE','poi',3050,1170,{name:'Đỉnh đập Đông / trạm bảo trì', valueNormal:50000, valueEasy:20000, risk:2, lootMin:2, loot:'phòng bàn medkit, thùng dã ngoại; sát điểm rút F'});

  /* waypoints (roads) */
  add('wCemS','wp',1330,1590); add('wTunW','wp',1713,1518); add('wN','wp',1900,980); add('wNE','wp',2700,1150);
  add('wS8E','wp',2520,1480); add('wValley','wp',2500,2020);

  /* edges: [a, b, riskMultiplier] — multiplier >1 means the path crosses contested ground */
  const edges = [
    ['xA','s1',1],['s1','xD',1],['xD','wCemS',1],['wCemS','cement',1.1],['s6','cement',1],
    ['s1','s2',1],['s2','westField',1],['westField','s3',1],['s2','cement',1.1],['s3','xE',1],['s3','barracks',1.1],
    ['xE','barracks',1],['barracks','s4',1],['barracks','s5',1],['s4','wN',1.2],['s5','wN',1.2],['wN','adminW',2.2],['wN','adminOut',1.5],
    ['cement','pipeline',1],['s7','pipeline',1],['pipeline','river',1],['river','xG',1],['xG','smallSub',1.1],['smallSub','s9',1],
    ['smallSub','mainSub',1.4],['cement','wTunW',1.1],['wTunW','underground',1.2],['underground','s8',1.3],['underground','mainSub',1.3],
    ['s8','mainSub',1.3],['s8','adminE',2.2],['adminW','adminE',2.5],['adminW','adminOut',1.8],['adminE','adminOut',1.8],['adminOut','xH',1.6],['adminOut','vault',2],
    ['adminOut','wNE',1.3],['wNE','damTopE',1],['damTopE','xF',1],['wNE','s12',1],['s12','xF',1],['s12','eastField',1],['eastField','s11',1],
    ['s8','wS8E',1.2],['wS8E','s11',1],['wS8E','mainSub',1.3],['s11','s10',1],['s9','wValley',1],['wValley','s10',1],['s10','visitor',1],
    ['visitor','s13',1],['s13','xB',1],['visitor','s14',1],['s14','xC',1],['s10','s14',1],['s12','wNE',1]
  ];

  /* keycard rooms: node = loot cluster the room sits in; price = Global 2025 / CN 2026 reference; ev = rough expected loot inside */
  const keycards = {
    dorm:{name:'Substation Dormitory (Ký túc Trạm biến áp)', node:'smallSub', p:N(2175,1889), price:34000, ev:150000, contents:'đồ đỏ trên bàn, tủ', tip:'ROI tốt nhất, khu ít tranh chấp. Mua đầu tiên.'},
    infirmary:{name:'West Wing Infirmary (Y tế Toà Tây)', node:'adminW', p:N(2192,1088), price:120000, ev:250000, contents:'y tế đỏ trên bàn và giường, medkit', tip:'Tốt nhưng nằm trong Admin; vào sau phút 8 khi đã tan trận đầu.'},
    equip:{name:'Equipment Collection Room (Toà Đông 1F)', node:'adminE', p:N(2342,1100), price:350000, ev:450000, contents:'bàn, kệ', tip:'Nhìn được đồ qua cửa trước khi mở.'},
    cementOffice:{name:'Cement Plant Office (Văn phòng Xi măng)', node:'cement', p:N(1537,1567), price:368000, ev:400000, contents:'xe đẩy', tip:'Nguồn mâu thuẫn về giá trị; chỉ mở khi thấy đồ.'},
    cementDorm:{name:'Cement Plant Dormitory 201', node:'cement', p:N(1352,1462), price:150000, ev:200000, contents:'phòng ký túc', tip:'Giá Global chưa rõ; nằm ngay cạnh spawn W6.'},
    barracksStore:{name:'Barracks Storage Room (Kho Doanh trại)', node:'barracks', p:N(1515,907), price:150000, ev:200000, contents:'kho đồ', tip:'Giá Global chưa rõ; khu ít người.'},
    vip:{name:'Central VIP Room (Du khách 2F)', node:'visitor', p:N(2967,2064), price:390000, ev:350000, contents:'vali, cặp', tip:'Thường không hoà vốn; chỉ dùng nếu nhặt được thẻ.'},
    ticket:{name:'Ticket Office (Du khách 1F)', node:'visitor', p:N(2927,2182), price:550000, ev:500000, contents:'két nhỏ, vali', tip:'Tuỳ chọn; khu an toàn.'},
    monitor:{name:'West Wing Monitoring Room', node:'adminW', p:N(2184,1093), price:645000, ev:700000, contents:'3 thùng máy tính', tip:'Giá trị cao nhưng ở Admin.'},
    control:{name:'West Wing Control Room', node:'adminW', p:N(2156,1012), price:1000000, ev:1100000, contents:'2 server, máy tính, radio quân sự, hộp đen', tip:'Nhìn qua cửa sổ trước khi mở; cạnh công tắc thang máy.'},
    tech:{name:'Substation Tech Room', node:'mainSub', p:N(2335,1727), price:3500000, ev:3000000, contents:'2 server, 1 két lớn, 2 áo lab', tip:'Chỉ mở nếu thấy đồ qua cửa sổ.'},
    manager:{name:'East Wing Manager\'s Office', node:'adminE', p:N(2286,1143), price:3000000, ev:3200000, contents:'2 két lớn, 2 cặp, hòm súng, máy tính', tip:'Canh bạc; boss Saeed spawn ngay dưới.'},
    underground:{name:'Underground Passage Key (Lối ngầm)', node:'underground', p:N(2055,1544), price:200000, ev:200000, contents:'phòng trong đường hầm', tip:'Giá Global chưa rõ.'}
  };

  window.ZD = {
    image:{src:'zero-dam.jpg?v=3fcdb2c412', width:2400, height:2100, metersX:950, metersY:832,
      credit:'Nền: deltaforcedb.com (bố cục trước S9, sông phía Nam hẹp hơn thực tế) © Tencent / Team Jade. Marker: công cụ map chính thức df.qq.com (9/2026). Giá trị loot: ước lượng.'},
    profiles:{easy:{kit:0, pDeath:[0.01,0.02,0.05,0.12,0.22], pTravel:0.006, pressure:0.12, rush:0.08, hazard:[0.002,0.005,0.012,0.03,0.055], minuteCost:4000, maxLootMin:14}, normal:{kit:112500, pDeath:[0.02,0.04,0.09,0.18,0.32], pTravel:0.012, pressure:0.2, rush:0.13, hazard:[0.004,0.009,0.022,0.05,0.09], minuteCost:7000, maxLootMin:14}},
    /* spawn rule (community guide image, 2026-01-19, matches the 14 official spawn markers): each side has 3 squads —
       exactly ONE squad in its "#1" pair (one position or the other, never both) and 2 squads among its 5 other spots */
    squads:{W:{pair:['s4','s5'], random:['s1','s2','s3','s6','s7'], randomSquads:2},
            E:{pair:['s8','s11'], random:['s9','s10','s12','s13','s14'], randomSquads:2}},
    // named chokepoints used to label ambush spots (px on the 4096 official map, converted like the nodes)
    landmarks:[['Đầu cầu phía Tây, cạnh công trường',1630,1640],['Đầu cầu phía Đông',1755,1610],['Đường bờ sông phía Đông',1800,1760],
      ['Thung lũng giữa E2 và E3',2500,2140],['Ngã ba phía Bắc Trung tâm du khách',2810,1860],['Đường vành đai Tây, lối về điểm rút A',1110,1540],
      ['Ngã ba Nam Trạm biến áp phụ',2120,1880],['Đường Bắc qua bờ hồ',1800,1050],['Bãi đỗ xe Admin',2420,1250]].map(([nm,x,y])=>({name:nm, p:N(x,y)})),
    contract:{minutes:1.5, radius:65},
    passBy:{share:0.6, minutes:0.25, max:3},  // high-value containers within ~20 m of the path: share of value grabbed, minutes each
    dropKeep:0.6,   // drop-backpack exit: share of loot value assumed kept in Safe Box + chest rig (assumption)  // time per in-raid contract (assumption) and how close a station must be to a stop
    nodes, edges, keycards
  };
})();
