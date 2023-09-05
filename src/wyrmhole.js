import { SquareArena } from "xiv-mech-sim/arena.js";
import { Entity } from "xiv-mech-sim/entities.js";
import { createSVGElement } from "xiv-mech-sim/drawing.js";
import { Hitbox } from "xiv-mech-sim/info_displays.js";
import { distance } from "xiv-mech-sim/utilities.js";

class PartyList {}

class Geirskogul extends Hitbox {
  #svgGroup;
  #castlocked;
  facing;
  target;
  targetLoc;
  #rect;
  constructor(loc) {
    super(4, loc);
    this.#castlocked = true;
    this.facing = 0;
    this.target = loc;
  }
  update(sim, msSinceLastUpdate) {
    super.update(sim, msSinceLastUpdate);
    let minDist = Number.POSITIVE_INFINITY;
    let closest;
    for (let pm of sim.party.list) {
      let dist = distance(pm, this.target);
      if (dist < minDist) {
        minDist = dist;
        closest = pm;
      }
    }
    let angle =
      (180 / Math.PI) *
      (Math.PI / 2 +
        Math.atan2(closest.y - this.target.y, closest.x - this.target.x));
    if (!this.#castlocked) {
      super.setDegreesCWFromN(angle);
      this.facing = (angle * Math.PI) / 180;
      this.targetLoc = { x: closest.x, y: closest.y };
    }
  }
  angleTo(target) {
    // radians!
    return Math.PI / 2 + Math.atan2(target.y - 100, target.x - 100);
  }
  castlock() {
    this.#castlocked = true;
  }
  removeCastlock() {
    this.#castlocked = false;
  }

  addToDrawing(drawing) {
    super.addToDrawing(drawing);
    this.#svgGroup = createSVGElement("g");
    drawing.layers.arenaClippedMechanics.append(this.#svgGroup);
  }

  removeFromDrawing(drawing) {
    super.removeFromDrawing(drawing);
    this.#svgGroup.remove();
  }

  hit(partyList) {
    let rect = createSVGElement("rect");
    rect.setAttribute("x", `${this.target.x - 4}`);
    rect.setAttribute("y", `${this.target.y - 100}`);
    rect.setAttribute("width", "8");
    rect.setAttribute("height", "100");
    rect.setAttribute("fill", "rgba(140,40,0,0.8)");
    rect.setAttribute(
      "transform",
      `rotate(${(180 / Math.PI) * this.facing} ${this.target.x} ${
        this.target.y
      })`,
    );
    this.#svgGroup.append(rect);
    for (let pm of partyList) {
      if (
        pm.label != "T1" &&
        Math.abs(
          (this.targetLoc.x - this.target.x) * (this.target.y - pm.y) -
            (this.target.x - pm.x) * (this.targetLoc.y - this.target.y),
        ) /
          Math.hypot(
            this.targetLoc.x - this.target.x,
            this.targetLoc.y - this.target.y,
          ) <
          4 &&
        // in line with geirskogul
        Math.cos(
          Math.atan2(
            this.targetLoc.y - this.target.y,
            this.targetLoc.x - this.target.x,
          ) - Math.atan2(pm.y - this.target.y, pm.x - this.target.x),
        ) > 0
      ) {
        // on same side of geirskogul as target
        pm.ko();
      }
    }
  }
}

class Facing extends Entity {
  #facing;
  #lastPos;
  #target;
  #arrow;
  #visible;
  color;
  #cached;

  constructor(target, color = "#3DAEFF") {
    super();
    this.#target = target;
    this.#facing = 0;
    this.#lastPos = { x: target.x ?? 100, y: target.y + 1 ?? 100 };
    this.color = color;
    this.#visible = false;
    this.#cached = null;
  }

  update(sim, msSinceLastUpdate) {
    super.update(sim, msSinceLastUpdate);
    if (
      this.#target.x == this.#lastPos.x &&
      this.#target.y == this.#lastPos.y
    ) {
      if (
        this.#cached !== null &&
        !this.#target.player_controlled &&
        this.#target.target_positions.length == 0
      ) {
        this.#facing = this.#cached;
        this.#arrow.setAttribute(
          "transform",
          `rotate(${this.#facing} ${this.#target.x} ${this.#target.y})`,
        );
        this.#cached = null;
      }
      return;
    }
    this.#facing =
      (180 / Math.PI) *
      (Math.PI / 2 +
        Math.atan2(
          this.#target.y - this.#lastPos.y,
          this.#target.x - this.#lastPos.x,
        ));
    this.#arrow.setAttribute(
      "d",
      `M ${this.#target.x - 0.5} ${this.#target.y - 1.5} h 1 l -0.5 ${
        -Math.sqrt(3) / 2
      } Z`,
    );
    this.#arrow.setAttribute(
      "transform",
      `rotate(${this.#facing} ${this.#target.x} ${this.#target.y})`,
    );
    this.#lastPos = { x: this.#target.x, y: this.#target.y };
  }

  addToDrawing(drawing) {
    this.#arrow = createSVGElement("path");
    this.#arrow.setAttribute(
      "d",
      `M ${this.#target.x - 0.5} ${this.#target.y - 1.5} h 1 l 0 ${
        -1.5 - Math.sqrt(3) / 2
      } Z`,
    );
    this.#arrow.setAttribute("fill", this.color);
    this.#arrow.setAttribute("fill-opacity", this.#visible ? "1" : "0");
    this.#arrow.setAttribute(
      "transform",
      `rotate(${this.#facing} ${this.#target.x} ${this.#target.y})`,
    );
    if (this.#target.player_controlled) {
      drawing.layers.player.append(this.#arrow);
    } else {
      drawing.layers.dutySupport.append(this.#arrow);
    }
  }

  removeFromDrawing(drawing) {
    if (this.#arrow) {
      this.#arrow.remove();
      this.#arrow = null;
    }
  }

  setVisible(vis) {
    this.#visible = vis;
    this.#arrow.setAttribute("fill-opacity", this.#visible ? "1" : "0");
  }

  cacheFacing(facing) {
    this.#cached = facing;
  }

  dropTower(scale) {
    return {
      x:
        this.#target.x +
        scale * 15 * Math.cos(((this.#facing - 90) * Math.PI) / 180),
      y:
        this.#target.y +
        scale * 15 * Math.sin(((this.#facing - 90) * Math.PI) / 180),
    };
  }
}

class AutoAttack extends Entity {
  #svgGroup;

  constructor(sim) {
    super();
    this.#svgGroup = null;
  }

  addToDrawing(drawing) {
    this.#svgGroup = createSVGElement("g");
    drawing.layers.arenaClippedMechanics.append(this.#svgGroup);
  }

  removeFromDrawing() {
    if (this.#svgGroup) {
      this.#svgGroup.remove();
      this.#svgGroup = null;
    }
  }

  hit(party) {
    let angle = Math.PI / 2 + Math.atan2(party.T1.y - 100, party.T1.x - 100);
    let rect = createSVGElement("rect");
    rect.setAttribute("x", "99");
    rect.setAttribute("y", "50");
    rect.setAttribute("width", "2");
    rect.setAttribute("height", "50");
    rect.setAttribute("fill", "rgba(140,40,0,0.8)");
    rect.setAttribute(
      "transform",
      `rotate(${(180 / Math.PI) * angle} 100 100)`,
    );
    this.#svgGroup.append(rect);
    let target = party.T1;
    for (let pm of party.list) {
      if (
        pm.label != "T1" &&
        Math.abs(
          (target.x - 100) * (100 - pm.y) - (100 - pm.x) * (target.y - 100),
        ) /
          Math.hypot(target.x - 100, target.y - 100) <
          1 &&
        // in line with tank
        Math.cos(
          Math.atan2(target.y - 100, target.x - 100) -
            Math.atan2(pm.y - 100, pm.x - 100),
        ) > 0
      ) {
        // on same side of boss as tank
        pm.ko();
      }
    }
  }
}

class Tower extends Entity {
  #svgGroup;
  #soakCount;
  target;
  #path;
  #rect;

  constructor(options) {
    super();
    this.#svgGroup = null;

    const defaults = {
      hit_color: "rgba(5,5,43,0.7)",
      miss_color: "rgba(140,40,0,0.8)",
      tower_color: "rgba(120,82,18,0.7)",
      radius: 5,
      soakCount: 1,
    };
    let resolvedOptions = { ...defaults, ...options };
    this.outerRadius = resolvedOptions.radius;
    this.innerRadius = this.outerRadius - 1;
    this.#soakCount = resolvedOptions.soakCount;
    this.warning_color = resolvedOptions.tower_color;
    this.hit_color = resolvedOptions.hit_color;
    this.miss_color = resolvedOptions.miss_color;
    this.target = resolvedOptions.target;
  }

  addToDrawing(drawing) {
    this.#svgGroup = createSVGElement("g");
    this.#path = createSVGElement("path");
    this.#path.setAttribute(
      "d",
      `M0,-${this.outerRadius}
    A${this.outerRadius} ${this.outerRadius} 0 0 1 0,${this.outerRadius}
    A${this.outerRadius} ${this.outerRadius} 0 0 1 0,-${this.outerRadius}
    M0,-${this.innerRadius}
    A${this.innerRadius} ${this.innerRadius} 0 0 0 0,${this.innerRadius}
    A${this.innerRadius} ${this.innerRadius} 0 0 0 0,-${this.innerRadius}`,
    );
    this.#path.setAttribute(
      "fill",
      this.has_hit ? this.hit_color : this.warning_color,
    );
    this.#path.setAttribute(
      "transform",
      `translate(${this.target.x},${this.target.y})`,
    );
    this.#rect = createSVGElement("rect");
    this.#rect.setAttribute("x", `${this.target.x - 0.5}`);
    this.#rect.setAttribute("y", `${this.target.y - 10}`);
    this.#rect.setAttribute("width", "1");
    this.#rect.setAttribute("height", `${10}`);
    this.#rect.setAttribute(
      "fill",
      this.has_hit ? this.hit_color : this.warning_color,
    );
    this.#svgGroup.append(this.#path);
    this.#svgGroup.append(this.#rect);

    drawing.layers.arenaClippedMechanics.append(this.#svgGroup);
  }

  removeFromDrawing() {
    if (this.#path !== null) {
      this.#path.remove();
      this.#path = null;
    }
    if (this.#svgGroup !== null) {
      this.#svgGroup.remove();
      this.#svgGroup = null;
    }
    if (this.#rect !== null) {
      this.#rect.remove();
      this.#rect = null;
    }
  }

  hit(partyList) {
    let targets = [];
    for (let pm of partyList) {
      if (Object.is(pm, this.target)) {
        continue;
      }
      if (distance(pm, this.target) <= this.outerRadius) {
        targets.push(pm);
      }
    }
    let success = targets.length >= this.#soakCount;
    if (!success) {
      for (let pm of partyList) {
        pm.ko();
      }
    }
    this.has_hit = true;
    if (this.#path !== null) {
      this.innerRadius = 0;
      this.#path.setAttribute(
        "d",
        `M0,-${this.outerRadius}
        A${this.outerRadius} ${this.outerRadius} 0 0 1 0,${this.outerRadius}
        A${this.outerRadius} ${this.outerRadius} 0 0 1 0,-${this.outerRadius}
        M0,-${this.innerRadius}
        A${this.innerRadius} ${this.innerRadius} 0 0 0 0,${this.innerRadius}
        A${this.innerRadius} ${this.innerRadius} 0 0 0 0,-${this.innerRadius}`,
      );
      this.#path.setAttribute(
        "fill",
        success ? this.hit_color : this.miss_color,
      );
    }
    if (this.#rect !== null) {
      this.#rect.remove();
      this.#rect = null;
    }
    // hit effect should be stationary
    this.target = { x: this.target.x, y: this.target.y };
    return targets;
  }
}

class Nidhogg extends Hitbox {
  #castlocked;
  facing;
  constructor() {
    super(15);
    this.#castlocked = false;
  }
  update(sim, msSinceLastUpdate) {
    super.update(sim, msSinceLastUpdate);
    let angle =
      (180 / Math.PI) *
      (Math.PI / 2 + Math.atan2(sim.party.T1.y - 100, sim.party.T1.x - 100));
    if (!this.#castlocked) {
      super.setDegreesCWFromN(angle);
      this.facing = (angle * Math.PI) / 180;
    }
  }
  angleToMT(sim) {
    // radians!
    return Math.PI / 2 + Math.atan2(sim.party.T1.y - 100, sim.party.T1.x - 100);
  }
  castlock() {
    this.#castlocked = true;
  }
  removeCastlock() {
    this.#castlocked = false;
  }
  autoAttack(sim, time) {
    let auto = new AutoAttack();
    sim.timeline.addEvent(time, () => {
      sim.entities.add(auto);
      auto.hit(sim.party);
    });
    sim.timeline.addEvent(time + 300, () => {
      sim.entities.remove(auto);
    });
  }
  angleFromTarget(target) {
    // degrees...
    return (
      (180 / Math.PI) *
      (Math.PI / 2 + Math.atan2(100 - target.y, 100 - target.x))
    );
  }
  rotateAndNormal(target, targetFacing, targetR) {
    // Generates an array for duty support that rotates the player around the boss while also moving in/out at the same time.
    let r = Math.hypot(target.x - 100, target.y - 100);
    let theta = Math.atan2(target.y - 100, target.x - 100);
    let targetTheta = ((targetFacing - 90) * Math.PI) / 180;
    if (targetTheta - theta > Math.PI) {
      theta += 2 * Math.PI;
    } else if (targetTheta - theta < -Math.PI) {
      theta -= 2 * Math.PI;
    }
    return Array(100)
      .fill(0)
      .map((_, i) => {
        let newR = r + (targetR - r) * ((i + 1) / 100);
        let newTheta = theta + (targetTheta - theta) * ((i + 1) / 100);
        let res = {
          x: 100 + newR * Math.cos(newTheta),
          y: 100 + newR * Math.sin(newTheta),
        };
        return res;
      });
  }
}

class DSRP3Arena extends SquareArena {
  #image;
  constructor(sim) {
    super(sim, 40, "#b0befc");
  }

  addToDrawing(drawing) {
    super.addToDrawing(drawing);
    this.#image = createSVGElement("image");
    this.#image.setAttribute("x", `80`);
    this.#image.setAttribute("y", `80`);
    this.#image.setAttribute("width", `40`);
    this.#image.setAttribute("height", `40`);
    this.#image.setAttribute("href", "dsu-p3-cropped.png");
    //this.#rect.setAttribute("fill-opacity", 0);
    drawing.layers.arena.append(this.#image);
  }
}

export { Geirskogul, Tower, Facing, Nidhogg, DSRP3Arena };
