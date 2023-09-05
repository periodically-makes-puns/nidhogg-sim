import { Sim } from "xiv-mech-sim";
import {
  Castbar,
  Success,
  LCNumbers,
  BossSpeech,
} from "xiv-mech-sim/info_displays.js";
import { Geirskogul, Facing, Nidhogg, DSRP3Arena, Tower } from "./wyrmhole";
import { blurNumber } from "xiv-mech-sim/utilities.js";
import { CircleAoE, DonutAoE, Stacks } from "xiv-mech-sim/mechanics.js";

// initFn and the things it's calling are organized the way I usually
// do them, but you can absolutely replace its contents entirely
let sim = new Sim({
  placeholderId: "sim",
  drawingSize: 50, // yalms!
  backgroundColor: "#00072b",
  menuId: "menu",
  initFn: function (sim) {
    rollRNG(sim);
    sim.entities.add(new DSRP3Arena(sim));
    document.getElementById("bgm").pause();
    document.getElementById("bgm").volume =
      parseInt(document.getElementById("volume-slider").value) / 100;
    document.getElementById("bgm").currentTime = 0;
    setUpMechanics(sim);
    setUpDutySupport(sim);
    document.getElementById("bgm").play();
  },
});

sim.run();

/*let volDiv = document.getElementById("volume");
let volSlider = document.getElementById("volume-slider");
let txt = document.createTextNode(volSlider.value);
volDiv.appendChild(txt);
volSlider.addEventListener("onchange", () => {
  txt.nodeValue = document.getElementById("volume-slider").value;
})*/
let rngChoices = {};

function rollRNG(sim) {
  // set up rng here
  let toShuffle = sim.party.list.slice();
  const arrowChoice = Math.floor(Math.random() * 7);
  let assignments = ["1", "3"];
  for (let i = 1; i <= 3; i++) {
    if ((2 >> (i - 1)) & arrowChoice) {
      assignments.push(`${i}U`);
      assignments.push(`${i}D`);
    } else {
      assignments.push(`${i}`);
      assignments.push(`${i}`);
    }
  }
  console.log(assignments);
  rngChoices.debuffs = new Map();
  for (let i = 0; i < 8; i++) {
    let selected = Math.floor(Math.random() * toShuffle.length);
    rngChoices.debuffs.set(toShuffle[selected], assignments[i]);
    toShuffle.splice(selected, 1);
  }
  rngChoices.lashes = [Math.random() > 0.5, Math.random() > 0.5];
  console.log(JSON.stringify(rngChoices));
}

// all times are in milliseconds
const targetable = 4500;
const firstAutos = 9300;
const diveFromGrace = 17700;
const lash1 = 24800;
const lash2 = lash1 + 21500;
const succeed = lash2 + 24300;

let nidhogg, facings;
let towers = [];

function setUpMechanics(sim) {
  facings = new Map();
  let hasPlayer = false;
  sim.timeline.addEvent(1, () => {
    for (let pm of sim.party.list) {
      let facing = new Facing(pm);
      facings.set(pm, facing);
      sim.entities.add(facing);
      if (pm.player_controlled) {
        facing.setVisible(true);
        hasPlayer = true;
      }
    }
    if (!hasPlayer) {
      for (let [_, facing] of facings) facing.setVisible(true);
    }
  });
  nidhogg = new Nidhogg();
  let text = new BossSpeech("Thy final verse is sung!");
  let text2 = new BossSpeech("Thou hast survived my song...");
  let text3 = new BossSpeech("Curse thee and thine eye, Hraesvelgr!");
  sim.timeline.addEvent(targetable, () => {
    sim.entities.add(nidhogg);
    sim.entities.add(text);
  });
  sim.timeline.addEvent(firstAutos, () => {
    sim.entities.remove(text);
    sim.entities.add(text2);
  });
  nidhogg.autoAttack(sim, firstAutos);

  sim.timeline.addEvent(firstAutos + 3000, () => {
    sim.entities.remove(text2);
    sim.entities.add(text3);
  });
  nidhogg.autoAttack(sim, firstAutos + 3000);

  sim.timeline.addEvent(firstAutos + 6000, () => {
    sim.entities.remove(text3);
  });
  nidhogg.autoAttack(sim, firstAutos + 6000);
  let lcMap = new Map();
  for (let [pm, assignment] of rngChoices.debuffs) {
    lcMap.set(pm, assignment.charCodeAt(0) - 0x30);
  }
  let lc = new LCNumbers(lcMap);
  let castbarDFG = new Castbar("Dive From Grace", 4700);
  sim.timeline.addEvent(diveFromGrace, () => {
    sim.entities.add(castbarDFG);
    sim.entities.add(lc);
    nidhogg.castlock();
  });
  sim.timeline.addEvent(diveFromGrace + 4800, () => {
    sim.entities.remove(castbarDFG);
    sim.entities.remove(lc);
  });
  let castbarLash1 = new Castbar(
    rngChoices.lashes[0] ? "Lash and Gnash" : "Gnash and Lash",
    7300,
  );
  sim.timeline.addEvent(lash1, () => {
    sim.entities.add(castbarLash1);
  });
  let aoes = [];
  for (let pm of sim.party.list) {
    if (rngChoices.debuffs.get(pm).startsWith("1")) {
      aoes.push(new CircleAoE({ target: pm, radius: 5 }));
    }
  }
  let stack;
  sim.timeline.addEvent(lash1 + 7400, () => {
    sim.entities.remove(castbarLash1);
    let spreads = [];
    for (let aoe of aoes) {
      sim.entities.add(aoe);
      switch (rngChoices.debuffs.get(aoe.target)) {
        case "1":
          towers.push(facings.get(aoe.target).dropTower(0));
          break;
        case "1U":
          towers.push(facings.get(aoe.target).dropTower(1));
          break;
        case "1D":
          towers.push(facings.get(aoe.target).dropTower(-1));
          break;
      }
      spreads.push(aoe.target);
      aoe.hit(sim.party.list);
    }
    let front = [
      100 + 7.5 * Math.sin(nidhogg.facing),
      100 - 7.5 * Math.cos(nidhogg.facing),
    ];
    let minDist = Number.POSITIVE_INFINITY;
    let target;
    for (let pm of sim.party.list) {
      let dist = Math.hypot(pm.x - front[0], pm.y - front[1]);
      if (dist < minDist) {
        minDist = dist;
        target = pm;
      }
    }
    stack = new Stacks({ targets: [target], soak_count: 5, radius: 5 });
    sim.entities.add(stack);
    stack.hit(sim.party.list);
    for (let spread of spreads) {
      if (
        Object.is(target, spread) ||
        Math.hypot(target.x - spread.x, target.y - spread.y) < 5
      ) {
        target.ko();
      }
    }
  });
  sim.timeline.addEvent(lash1 + 7800, () => {
    for (let aoe of aoes) {
      sim.entities.remove(aoe);
    }
    sim.entities.remove(stack);
  });
  let gnashHit1 = new CircleAoE({ target: { x: 100, y: 100 }, radius: 7.5 });
  let lashHit1 = new DonutAoE({
    target: { x: 100, y: 100 },
    inner_radius: 7.5,
    outer_radius: 80,
  });
  sim.timeline.addEvent(lash1 + 11300, () => {
    if (rngChoices.lashes[0]) {
      sim.entities.add(lashHit1);
      lashHit1.hit(sim.party.list);
    } else {
      sim.entities.add(gnashHit1);
      gnashHit1.hit(sim.party.list);
    }
    towers = towers.map((loc) => {
      let tower = new Tower({ target: loc });
      sim.entities.add(tower);
      return tower;
    });
  });
  sim.timeline.addEvent(lash1 + 11700, () => {
    if (rngChoices.lashes[0]) {
      sim.entities.remove(lashHit1);
    } else {
      sim.entities.remove(gnashHit1);
    }
  });
  sim.timeline.addEvent(lash1 + 14400, () => {
    if (rngChoices.lashes[0]) {
      sim.entities.add(gnashHit1);
      gnashHit1.hit(sim.party.list);
    } else {
      sim.entities.add(lashHit1);
      lashHit1.hit(sim.party.list);
    }
    for (let tower of towers) {
      tower.hit(sim.party.list);
    }
  });
  let geirskoguls = [];
  sim.timeline.addEvent(lash1 + 14800, () => {
    if (rngChoices.lashes[0]) {
      sim.entities.remove(gnashHit1);
    } else {
      sim.entities.remove(lashHit1);
    }
    for (let tower of towers) {
      sim.entities.remove(tower);
      let geirs = new Geirskogul(tower.target);
      geirskoguls.push(geirs);
      sim.entities.add(geirs);
    }
  });
  sim.timeline.addEvent(lash1 + 16600, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.removeCastlock();
    }
  });
  sim.timeline.addEvent(lash1 + 16800, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.castlock();
    }
  });
  let aoes2 = [];
  for (let pm of sim.party.list) {
    if (rngChoices.debuffs.get(pm).startsWith("2")) {
      aoes2.push(new CircleAoE({ target: pm, radius: 5 }));
    }
  }
  sim.timeline.addEvent(lash1 + 17500, () => {
    let spreads = [];
    towers = [];
    for (let aoe of aoes2) {
      sim.entities.add(aoe);
      switch (rngChoices.debuffs.get(aoe.target)) {
        case "2":
          towers.push(facings.get(aoe.target).dropTower(0));
          break;
        case "2U":
          towers.push(facings.get(aoe.target).dropTower(1));
          break;
        case "2D":
          towers.push(facings.get(aoe.target).dropTower(-1));
          break;
      }
      spreads.push(aoe.target);
      aoe.hit(sim.party.list);
    }
  });
  sim.timeline.addEvent(lash1 + 17900, () => {
    for (let aoe of aoes2) {
      sim.entities.remove(aoe);
    }
  });
  sim.timeline.addEvent(lash1 + 21200, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.hit(sim.party.list);
    }
  });
  let castbarLash2 = new Castbar(
    rngChoices.lashes[1] ? "Lash and Gnash" : "Gnash and Lash",
    7300,
  );
  sim.timeline.addEvent(lash2, () => {
    sim.entities.add(castbarLash2);
  });
  sim.timeline.addEvent(lash2 + 200, () => {
    towers = towers.map((loc) => {
      let tower = new Tower({ target: loc });
      sim.entities.add(tower);
      return tower;
    });
    for (let geirskogul of geirskoguls) {
      sim.entities.remove(geirskogul);
    }
  });
  sim.timeline.addEvent(lash2 + 2400, () => {
    for (let tower of towers) {
      tower.hit(sim.party.list);
    }
  });
  sim.timeline.addEvent(lash2 + 2800, () => {
    geirskoguls = [];
    for (let tower of towers) {
      sim.entities.remove(tower);
      let geirs = new Geirskogul(tower.target);
      geirskoguls.push(geirs);
      sim.entities.add(geirs);
    }
  });
  sim.timeline.addEvent(lash2 + 4600, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.removeCastlock();
    }
  });
  sim.timeline.addEvent(lash2 + 4800, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.castlock();
    }
  });
  towers = [];
  let stack2;
  let aoes3 = [];
  for (let pm of sim.party.list) {
    if (rngChoices.debuffs.get(pm).startsWith("3")) {
      aoes3.push(new CircleAoE({ target: pm, radius: 5 }));
    }
  }
  sim.timeline.addEvent(lash2 + 7400, () => {
    sim.entities.remove(castbarLash2);
    let spreads = [];
    towers = [];
    for (let aoe of aoes3) {
      sim.entities.add(aoe);
      switch (rngChoices.debuffs.get(aoe.target)) {
        case "3":
          towers.push(facings.get(aoe.target).dropTower(0));
          break;
        case "3U":
          towers.push(facings.get(aoe.target).dropTower(1));
          break;
        case "3D":
          towers.push(facings.get(aoe.target).dropTower(-1));
          break;
      }
      spreads.push(aoe.target);
      aoe.hit(sim.party.list);
    }
    let front = [
      100 + 7.5 * Math.sin(nidhogg.facing),
      100 - 7.5 * Math.cos(nidhogg.facing),
    ];
    let minDist = Number.POSITIVE_INFINITY;
    let target;
    for (let pm of sim.party.list) {
      let dist = Math.hypot(pm.x - front[0], pm.y - front[1]);
      if (dist < minDist) {
        minDist = dist;
        target = pm;
      }
    }
    stack2 = new Stacks({ targets: [target], soak_count: 5, radius: 5 });
    sim.entities.add(stack2);
    stack2.hit(sim.party.list);
    for (let spread of spreads) {
      if (
        Object.is(target, spread) ||
        Math.hypot(target.x - spread.x, target.y - spread.y) < 5
      ) {
        target.ko();
      }
    }
  });
  sim.timeline.addEvent(lash2 + 7800, () => {
    for (let aoe of aoes3) {
      sim.entities.remove(aoe);
    }
    sim.entities.remove(stack2);
  });
  sim.timeline.addEvent(lash2 + 9600, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.hit(sim.party.list);
    }
  });
  sim.timeline.addEvent(lash2 + 10100, () => {
    for (let geirskogul of geirskoguls) {
      sim.entities.remove(geirskogul);
    }
  });

  let gnashHit2 = new CircleAoE({ target: { x: 100, y: 100 }, radius: 7.5 });
  let lashHit2 = new DonutAoE({
    target: { x: 100, y: 100 },
    inner_radius: 7.5,
    outer_radius: 80,
  });
  sim.timeline.addEvent(lash2 + 11300, () => {
    if (rngChoices.lashes[1]) {
      sim.entities.add(lashHit2);
      lashHit2.hit(sim.party.list);
    } else {
      sim.entities.add(gnashHit2);
      gnashHit2.hit(sim.party.list);
    }
    towers = towers.map((loc) => {
      let tower = new Tower({ target: loc });
      sim.entities.add(tower);
      return tower;
    });
  });
  sim.timeline.addEvent(lash2 + 11700, () => {
    if (rngChoices.lashes[1]) {
      sim.entities.remove(lashHit2);
    } else {
      sim.entities.remove(gnashHit2);
    }
  });
  sim.timeline.addEvent(lash2 + 14400, () => {
    if (rngChoices.lashes[1]) {
      sim.entities.add(gnashHit2);
      gnashHit2.hit(sim.party.list);
    } else {
      sim.entities.add(lashHit2);
      lashHit2.hit(sim.party.list);
    }
    for (let tower of towers) {
      tower.hit(sim.party.list);
    }
  });
  sim.timeline.addEvent(lash2 + 14800, () => {
    if (rngChoices.lashes[1]) {
      sim.entities.remove(gnashHit2);
    } else {
      sim.entities.remove(lashHit2);
    }
    geirskoguls = [];
    for (let tower of towers) {
      sim.entities.remove(tower);
      let geirs = new Geirskogul(tower.target);
      geirskoguls.push(geirs);
      sim.entities.add(geirs);
    }
  });
  sim.timeline.addEvent(lash2 + 16600, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.removeCastlock();
    }
  });
  sim.timeline.addEvent(lash2 + 16800, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.castlock();
    }
  });
  sim.timeline.addEvent(lash2 + 18500, () => {
    nidhogg.removeCastlock();
  });
  nidhogg.autoAttack(sim, lash2 + 18500);
  sim.timeline.addEvent(lash2 + 20800, () => {
    for (let geirskogul of geirskoguls) {
      geirskogul.hit(sim.party.list);
    }
  });
  sim.timeline.addEvent(lash2 + 21300, () => {
    for (let geirskogul of geirskoguls) {
      sim.entities.remove(geirskogul);
    }
  });
  nidhogg.autoAttack(sim, lash2 + 21500);
  sim.timeline.addEvent(succeed, () => {
    sim.entities.add(new Success());
    sim.endRun();
  });
}

function setUpDutySupport(sim) {
  let party = sim.party.list;

  // randomize starting positions

  for (let pm of party) {
    pm.set_position(blurNumber(100, 0.5), blurNumber(105, 0.5));
  }
  sim.party.T1.set_position(100, 92.5);
  sim.timeline.addEvent(targetable + 500, () => {
    let angles = [];
    for (let pm of party) {
      if (Object.is(pm, sim.party.T1)) continue;
      let found = false;
      let angle;
      while (!found) {
        found = true;
        angle = Math.random() * Math.PI + Math.PI / 2;
        for (let a of angles) {
          if (Math.abs(angle - a) < Math.PI / 12) found = false;
        }
      }
      angles.push(angle);
      let loc = {
        x: blurNumber(100 + 7.5 * Math.sin(angle), 0.3),
        y: blurNumber(100 - 7.5 * Math.cos(angle), 0.3),
      };
      pm.set_target_positions([loc]); // start south and soft spread
      facings.get(pm).cacheFacing(nidhogg.angleFromTarget(loc));
    }
  });
  let towers1 = [];
  let reorder1 = Array(3).fill(null);
  let towers2 = [];
  let reorder2 = Array(3).fill(null);
  let towers3 = [];
  let reorder3 = Array(3).fill(null);
  let targets1, targets2, targets3;
  sim.timeline.addEvent(diveFromGrace + 700, () => {
    for (let pm of party) {
      let debuff = rngChoices.debuffs.get(pm);
      switch (debuff) {
        case "1U":
          reorder1[0] = pm;
          towers1.push(pm);
          break;
        case "1D":
          reorder1[2] = pm;
          towers1.push(pm);
          break;
        case "1":
          reorder1[1] = pm;
          towers1.push(pm);
          break;
        case "2U":
          reorder2[0] = pm;
          towers2.push(pm);
          break;
        case "2D":
          reorder2[2] = pm;
          towers2.push(pm);
          break;
        case "2":
          reorder2[1] = pm;
          towers2.push(pm);
          break;
        case "3U":
          reorder3[0] = pm;
          towers3.push(pm);
          break;
        case "3D":
          reorder3[2] = pm;
          towers3.push(pm);
          break;
        case "3":
          reorder3[1] = pm;
          towers3.push(pm);
          break;
        default:
          console.error(`Recieved invalid debuff ${debuff}`);
      }
    }
    towers1.sort((a, b) => {
      return a.x - b.x;
    });
    targets1 = [
      { x: 92.5, y: 100 },
      { x: 100, y: 107.5 },
      { x: 107.5, y: 100 },
    ];
    for (let i = 0; i < 3; i++) {
      towers1[i].set_target_positions([targets1[i]]);
      facings.get(towers1[i]).cacheFacing(nidhogg.angleFromTarget(targets1[i]));
      if (Object.is(reorder1[2], null)) {
        reorder1[i] = towers1[i];
      }
    }
    towers3.sort((a, b) => {
      return a.x - b.x;
    });
    targets3 = [
      { x: 95, y: 100 },
      { x: 100, y: 105 },
      { x: 105, y: 100 },
    ];
    for (let i = 0; i < 3; i++) {
      towers3[i].set_target_positions([targets3[i]]);
      facings.get(towers3[i]).cacheFacing(nidhogg.angleFromTarget(targets3[i]));
      if (Object.is(reorder3[2], null)) {
        reorder3[i] = towers3[i];
      }
    }
    towers2.sort((a, b) => {
      return a.x - b.x;
    });
    targets2 = [
      { x: 98, y: 94 },
      { x: 102, y: 94 },
    ];
    for (let i = 0; i < 2; i++) {
      towers2[i].set_target_positions([targets2[i]]);
      facings.get(towers2[i]).cacheFacing(nidhogg.angleFromTarget(targets2[i]));
      if (Object.is(reorder2[2], null)) {
        reorder2[i] = towers2[i];
      }
    }
    reorder2[1] ??= reorder2[2];
    console.log(reorder1, reorder2, reorder3);
  });
  sim.timeline.addEvent(lash1 + 700, () => {
    for (let i = 0; i < 3; i++) {
      reorder1[i].set_target_positions([targets1[i]]);
      facings
        .get(reorder1[i])
        .cacheFacing(nidhogg.angleFromTarget(targets1[i]));
    }
    for (let pm of party) {
      switch (rngChoices.debuffs.get(pm)) {
        case "2":
        case "2U":
        case "2D":
        case "3":
        case "3U":
        case "3D":
          let loc = {
            x: blurNumber(100, 0.5),
            y: blurNumber(92.5 + (rngChoices.lashes[0] ? 1 : -1), 0.5),
          };
          pm.set_target_positions([loc]);
          facings.get(pm).cacheFacing(nidhogg.angleFromTarget(loc));
      }
    }
  });
  sim.timeline.addEvent(lash1 + 6300, () => {
    for (let pm of party) {
      if (rngChoices.debuffs.get(pm) == "1D") {
        facings.get(pm).cacheFacing(nidhogg.angleFromTarget(pm) + 180); // turn around you lil shit
      }
    }
  });
  sim.timeline.addEvent(lash1 + 8000, () => {
    for (let pm of party) {
      switch (rngChoices.debuffs.get(pm)) {
        case "1":
        case "1U":
        case "1D":
          if (!rngChoices.lashes[0]) {
            let route = nidhogg.rotateAndNormal(
              pm,
              blurNumber(0, 5),
              blurNumber(9.5, 0.5),
            );
            pm.set_target_positions(route);
            facings.get(pm).cacheFacing(nidhogg.angleFromTarget(route[99]));
          } else {
            let loc = { x: blurNumber(100, 1), y: blurNumber(94.5, 1) };
            pm.set_target_positions([loc]);
            facings.get(pm).cacheFacing(nidhogg.angleFromTarget(loc));
          }
          break;
      }
    }
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      if (!rngChoices.lashes[0]) {
        let route = nidhogg.rotateAndNormal(reorder3[i], (3 - i) * 90, 9.5);
        reorder3[i].set_target_positions(route);
        finalLoc = route[99];
      } else {
        finalLoc = nidhogg.rotateAndNormal(reorder3[i], (3 - i) * 90, 5.5)[99];
        reorder3[i].set_target_positions([finalLoc]);
      }
      facings.get(reorder3[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });
  sim.timeline.addEvent(lash1 + 11700, () => {
    for (let pm of party) {
      switch (rngChoices.debuffs.get(pm)) {
        case "1":
        case "1U":
        case "1D":
        case "2":
        case "2U":
        case "2D":
          if (rngChoices.lashes[0]) {
            let route = nidhogg.rotateAndNormal(
              pm,
              blurNumber(0, 5),
              blurNumber(9.5, 0.5),
            );
            pm.set_target_positions(route);
            facings.get(pm).cacheFacing(nidhogg.angleFromTarget(route[99]));
          } else {
            let loc = { x: blurNumber(100, 1), y: blurNumber(94.5, 1) };
            pm.set_target_positions([loc]);
            facings.get(pm).cacheFacing(nidhogg.angleFromTarget(loc));
          }
          break;
      }
    }
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      if (!rngChoices.lashes[0]) {
        let route = nidhogg.rotateAndNormal(reorder3[i], (3 - i) * 90, 5.5);
        reorder3[i].set_target_positions(route);
        finalLoc = route[99];
      } else {
        finalLoc = nidhogg.rotateAndNormal(reorder3[i], (3 - i) * 90, 9.5)[99];
        reorder3[i].set_target_positions([finalLoc]);
      }
      facings.get(reorder3[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });
  sim.timeline.addEvent(lash1 + 14800, () => {
    for (let pm of party) {
      switch (rngChoices.debuffs.get(pm)) {
        case "1":
        case "1U":
        case "1D":
          let loc = { x: blurNumber(100, 1), y: blurNumber(92.5, 1) };
          pm.set_target_positions([loc]);
          facings.get(pm).cacheFacing(nidhogg.angleFromTarget(loc));
          break;
      }
    }
    for (let i = 0; i < 2; i++) {
      let finalLoc = { x: 100 - 7 + 2 * i * 7, y: 92.5 };
      reorder2[i].set_target_positions([finalLoc]);
      facings.get(reorder2[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      if (!rngChoices.lashes[0]) {
        let route = nidhogg.rotateAndNormal(reorder3[i], (3 - i) * 90, 9.5);
        reorder3[i].set_target_positions([route[99]]);
        finalLoc = route[99];
        facings.get(reorder3[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
      }
    }
  });
  sim.timeline.addEvent(lash1 + 16800, () => {
    for (let i = 0; i < 2; i++) {
      if (reorder2[2] !== null) facings.get(reorder2[i]).cacheFacing(90);
    }
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      let route = nidhogg.rotateAndNormal(reorder3[i], (3 - i) * 90, 5.5);
      reorder3[i].set_target_positions([route[99]]);
      finalLoc = route[99];
      facings.get(reorder3[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });
  sim.timeline.addEvent(lash1 + 18100, () => {
    for (let i = 0; i < 3; i++) {
      if (i == 1) continue;
      let finalLoc = { x: 100 - 7 + i * 7, y: 92.5 };
      reorder1[i].set_target_positions([finalLoc]);
      facings.get(reorder1[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
    for (let i = 0; i < 2; i++) {
      let loc = { x: blurNumber(100, 1), y: blurNumber(92.5, 1) };
      reorder2[i].set_target_positions([loc]);
      facings.get(reorder2[i]).cacheFacing(nidhogg.angleFromTarget(loc));
    }
  });
  sim.timeline.addEvent(lash2 + 3100, () => {
    for (let i = 0; i < 3; i++) {
      if (i == 1) continue;
      let finalLoc = { x: 100 - 8 + i * 8, y: 92 };
      reorder1[i].set_target_positions([finalLoc]);
      facings.get(reorder1[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      let route = nidhogg.rotateAndNormal(reorder3[i], (3 - i) * 90, 7.5);
      reorder3[i].set_target_positions([route[99]]);
      finalLoc = route[99];
      facings.get(reorder3[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });

  sim.timeline.addEvent(lash2 + 5100, () => {
    for (let i = 0; i < 3; i++) {
      let finalLoc = {
        x: blurNumber(100, 1),
        y: blurNumber(92.5 + (rngChoices.lashes[1] ? 1 : -1), 0.5),
      };
      reorder1[i].set_target_positions([finalLoc]);
      facings.get(reorder1[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
    for (let i = 0; i < 2; i++) {
      let finalLoc = {
        x: blurNumber(100, 1),
        y: blurNumber(92.5 + (rngChoices.lashes[1] ? 1 : -1), 0.5),
      };
      reorder2[i].set_target_positions([finalLoc]);
      facings.get(reorder2[i]).cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });
  sim.timeline.addEvent(lash2 + 6300, () => {
    for (let pm of party) {
      if (rngChoices.debuffs.get(pm) == "3D") {
        facings.get(pm).cacheFacing(nidhogg.angleFromTarget(pm) + 180); // turn around you lil shit
      }
    }
  });
  let tower3takers = [];
  sim.timeline.addEvent(lash2 + 8000, () => {
    for (let pm of party) {
      switch (rngChoices.debuffs.get(pm)) {
        case "3":
        case "3U":
        case "3D":
          if (!rngChoices.lashes[1]) {
            let route = nidhogg.rotateAndNormal(
              pm,
              blurNumber(0, 5),
              blurNumber(9.5, 0.5),
            );
            pm.set_target_positions(route);
            facings.get(pm).cacheFacing(nidhogg.angleFromTarget(route[99]));
          } else {
            let loc = { x: blurNumber(100, 1), y: blurNumber(94.5, 1) };
            pm.set_target_positions([loc]);
            facings.get(pm).cacheFacing(nidhogg.angleFromTarget(loc));
          }
          break;
      }
    }
    tower3takers = [reorder2[0], reorder1[1], reorder2[1]];
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      if (!rngChoices.lashes[1]) {
        let route = nidhogg.rotateAndNormal(tower3takers[i], (3 - i) * 90, 9.5);
        tower3takers[i].set_target_positions(route);
        finalLoc = route[99];
      } else {
        finalLoc = nidhogg.rotateAndNormal(
          tower3takers[i],
          (3 - i) * 90,
          5.5,
        )[99];
        tower3takers[i].set_target_positions([finalLoc]);
      }
      facings
        .get(tower3takers[i])
        .cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });
  sim.timeline.addEvent(lash2 + 11700, () => {
    for (let pm of party) {
      if (rngChoices.lashes[1]) {
        let route = nidhogg.rotateAndNormal(
          pm,
          blurNumber(0, 5),
          blurNumber(9.5, 0.5),
        );
        pm.set_target_positions(route);
        facings.get(pm).cacheFacing(nidhogg.angleFromTarget(route[99]));
      } else {
        let loc = { x: blurNumber(100, 1), y: blurNumber(94.5, 1) };
        pm.set_target_positions([loc]);
        facings.get(pm).cacheFacing(nidhogg.angleFromTarget(loc));
      }
    }
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      if (!rngChoices.lashes[1]) {
        let route = nidhogg.rotateAndNormal(tower3takers[i], (3 - i) * 90, 5.5);
        tower3takers[i].set_target_positions(route);
        finalLoc = route[99];
      } else {
        finalLoc = nidhogg.rotateAndNormal(
          tower3takers[i],
          (3 - i) * 90,
          9.5,
        )[99];
        tower3takers[i].set_target_positions([finalLoc]);
      }
      facings
        .get(tower3takers[i])
        .cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });
  sim.timeline.addEvent(lash2 + 14800, () => {
    for (let pm of party) {
      let loc = { x: blurNumber(100, 1), y: blurNumber(92.5, 1) };
      pm.set_target_positions([loc]);
      facings.get(pm).cacheFacing(nidhogg.angleFromTarget(loc));
    }
    let route = nidhogg.rotateAndNormal(sim.party.T1, 45, 7.5);
    sim.party.T1.set_target_positions(route);
    facings.get(sim.party.T1).cacheFacing(route[99]);
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      let route = nidhogg.rotateAndNormal(tower3takers[i], (3 - i) * 90, 9.5);
      tower3takers[i].set_target_positions([route[99]]);
      finalLoc = route[99];
      facings
        .get(tower3takers[i])
        .cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });
  sim.timeline.addEvent(lash2 + 16800, () => {
    for (let i = 0; i < 3; i++) {
      let finalLoc;
      let route;
      if (Object.is(tower3takers[i], sim.party.T1)) {
        route = nidhogg.rotateAndNormal(tower3takers[i], 215, 5.5);
      } else {
        route = nidhogg.rotateAndNormal(tower3takers[i], (3 - i) * 90, 5.5);
      }
      tower3takers[i].set_target_positions([route[99]]);
      finalLoc = route[99];
      facings
        .get(tower3takers[i])
        .cacheFacing(nidhogg.angleFromTarget(finalLoc));
    }
  });
}
