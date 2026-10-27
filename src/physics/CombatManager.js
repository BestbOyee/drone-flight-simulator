import * as THREE from 'three';

export class CombatManager {
  constructor(scene, soundEngine) {
    this.scene = scene;
    this.soundEngine = soundEngine;

    // Combat Stats
    this.playerHealth = 100;
    this.playerMaxHealth = 100;
    this.kills = 0;
    this.score = 0;
    this.isPlayerDead = false;
    this.respawnTimer = 0;

    // Laser Projectiles
    this.projectiles = [];
    this.playerLaserSpeed = 125; // Fast, responsive laser bolts
    this.enemyLaserSpeed = 85;
    this.laserCooldown = 0; // seconds

    // Materials & Shared Geometries
    this.playerBoltGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8);
    this.playerBoltGeo.rotateX(Math.PI / 2);
    this.playerBoltMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });

    this.enemyBoltGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.8, 8);
    this.enemyBoltGeo.rotateX(Math.PI / 2);
    this.enemyBoltMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });

    // VFX Particles for Explosions
    this.explosions = [];

    // AI Enemies (Level 1: 3 patrol drones)
    this.enemies = [];
    this.initLevel1Enemies();
  }

  initLevel1Enemies() {
    const enemyConfigs = [
      { id: 1, pos: new THREE.Vector3(45, 12, -60), patrolCenter: new THREE.Vector3(40, 12, -60) },
      { id: 2, pos: new THREE.Vector3(-55, 16, -80), patrolCenter: new THREE.Vector3(-50, 16, -80) },
      { id: 3, pos: new THREE.Vector3(0, 18, -120), patrolCenter: new THREE.Vector3(0, 18, -120) }
    ];

    enemyConfigs.forEach((cfg) => {
      const droneGroup = this._createEnemyDroneMesh();
      droneGroup.position.copy(cfg.pos);
      this.scene.add(droneGroup);

      this.enemies.push({
        id: cfg.id,
        mesh: droneGroup,
        position: cfg.pos.clone(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Euler(0, 0, 0),
        patrolCenter: cfg.patrolCenter,
        patrolAngle: Math.random() * Math.PI * 2,
        patrolRadius: 35 + Math.random() * 20,
        health: 60, // 3 hits from player (20 dmg per hit)
        maxHealth: 60,
        isDead: false,
        respawnTimer: 0,
        fireCooldown: 1.5 + Math.random() * 1.5,
        rotors: droneGroup.userData.rotors || []
      });
    });
  }

  _createEnemyDroneMesh() {
    const group = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.25 });
    const redMat = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#b91c1c', emissiveIntensity: 0.7 });

    // Central chassis
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.0), darkMat);
    body.castShadow = true;
    group.add(body);

    // Glowing Crimson Sensor Eye
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), redMat);
    eye.position.set(0, 0.05, 0.45);
    group.add(eye);

    // Arms & Rotors
    const rotors = [];
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.6 });
    const armPositions = [
      { x: -1.5, z: -0.9 },
      { x: 1.5, z: -0.9 },
      { x: 1.5, z: 0.9 },
      { x: -1.5, z: 0.9 }
    ];

    armPositions.forEach((pos) => {
      const dist = Math.hypot(pos.x, pos.z);
      const angle = Math.atan2(pos.x, pos.z);

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, dist, 8), darkMat);
      arm.position.set(pos.x / 2, 0, pos.z / 2);
      arm.rotation.x = Math.PI / 2;
      arm.rotation.z = -angle;
      group.add(arm);

      const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10), redMat);
      mount.position.set(pos.x, 0.05, pos.z);
      group.add(mount);

      const rotor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.2), bladeMat);
      rotor.position.set(pos.x, 0.16, pos.z);
      group.add(rotor);
      rotors.push(rotor);
    });

    group.userData.rotors = rotors;
    return group;
  }

  // ------------------------------------------------------------
  // Fire Player Laser (Fired along drone heading & pitch)
  // ------------------------------------------------------------
  firePlayerLaser(playerPos, playerRot, playerVel) {
    if (this.isPlayerDead || this.laserCooldown > 0) return false;
  
    const forwardDir = new THREE.Vector3(0, 0, 1).applyEuler(playerRot).normalize();
    const spawnPos = playerPos.clone().add(forwardDir.clone().multiplyScalar(1.2));
  
    // --- Aim Assist: snap to nearest enemy within a forgiving cone ---
    const ASSIST_CONE_RAD = THREE.MathUtils.degToRad(20);
    const ASSIST_MAX_RANGE = 110;
    let fireDir = forwardDir.clone();
    let bestAngle = ASSIST_CONE_RAD;
    let bestEnemy = null;
  
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const toEnemy = new THREE.Vector3().subVectors(enemy.position, spawnPos);
      const dist = toEnemy.length();
      if (dist > ASSIST_MAX_RANGE) continue;
      toEnemy.normalize();
      const angle = forwardDir.angleTo(toEnemy);
      if (angle < bestAngle) {
        bestAngle = angle;
        bestEnemy = enemy;
      }
    }
  
    if (bestEnemy) {
      fireDir = new THREE.Vector3().subVectors(bestEnemy.position, spawnPos).normalize();
    }
  
    const boltVel = fireDir.multiplyScalar(this.playerLaserSpeed).add(playerVel.clone().multiplyScalar(0.3));
  
    const mesh = new THREE.Mesh(this.playerBoltGeo, this.playerBoltMat);
    mesh.position.copy(spawnPos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), boltVel.clone().normalize());
    this.scene.add(mesh);
  
    this.projectiles.push({
      mesh,
      position: spawnPos,
      velocity: boltVel,
      isEnemy: false,
      damage: 20,
      life: 2.2
    });
  
    this.soundEngine?.playLaserFire(false);
    this.laserCooldown = 0.16;
    return true;
  }

  // ------------------------------------------------------------
  // Fire Enemy Laser
  // ------------------------------------------------------------
  _fireEnemyLaser(enemyPos, targetPos, enemyVel) {
    const dir = new THREE.Vector3().subVectors(targetPos, enemyPos).normalize();
    const spawnPos = enemyPos.clone().add(dir.clone().multiplyScalar(1.4));
    const boltVel = dir.multiplyScalar(this.enemyLaserSpeed);

    const mesh = new THREE.Mesh(this.enemyBoltGeo, this.enemyBoltMat);
    mesh.position.copy(spawnPos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), boltVel.clone().normalize());
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      position: spawnPos,
      velocity: boltVel,
      isEnemy: true,
      damage: 20,
      life: 2.5
    });

    this.soundEngine?.playLaserFire(true);
  }

  // ------------------------------------------------------------
  // Explosion Particle Spawner
  // ------------------------------------------------------------
  spawnExplosion(pos) {
    const count = 35;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22 + 4,
        (Math.random() - 0.5) * 22
      );
      velocities.push(v);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#fb923c',
      size: 1.1,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    this.explosions.push({
      points,
      velocities,
      life: 0.9,
      maxLife: 0.9
    });

    this.soundEngine?.playExplosion();
  }

  // ------------------------------------------------------------
  // Main Combat Update Loop
  // ------------------------------------------------------------
  update(delta, playerPhysics) {
    if (this.laserCooldown > 0) {
      this.laserCooldown -= delta;
    }

    let hitRegistered = false;
    let playerHitRegistered = false;

    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      p.position.addScaledVector(p.velocity, delta);
      p.mesh.position.copy(p.position);

      let destroyed = false;

      // Ground collision
      if (p.position.y <= 0.1) {
        destroyed = true;
      }

      // Hit checks
      if (!destroyed) {
        if (!p.isEnemy) {
          // Player bolt -> Check enemy hitboxes
          for (const enemy of this.enemies) {
            if (enemy.isDead) continue;
            if (p.position.distanceTo(enemy.position) < 3.2) {
              enemy.health -= p.damage;
              hitRegistered = true;
              this.soundEngine?.playHitSound();

              if (enemy.health <= 0) {
                enemy.isDead = true;
                enemy.respawnTimer = 6.0;
                enemy.mesh.visible = false;
                this.kills += 1;
                this.score += 250;
                this.spawnExplosion(enemy.position);
              }

              destroyed = true;
              break;
            }
          }
        } else if (!this.isPlayerDead) {
          // Enemy bolt -> Check player hitbox
          if (p.position.distanceTo(playerPhysics.position) < 2.0) {
            this.playerHealth = Math.max(0, this.playerHealth - p.damage);
            playerHitRegistered = true;
            this.soundEngine?.playHitSound();

            if (this.playerHealth <= 0) {
              this.isPlayerDead = true;
              this.respawnTimer = 3.0;
              this.spawnExplosion(playerPhysics.position);
            }

            destroyed = true;
          }
        }
      }

      if (destroyed || p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // 2. Update AI Enemies
    for (const enemy of this.enemies) {
      if (enemy.isDead) {
        enemy.respawnTimer -= delta;
        if (enemy.respawnTimer <= 0) {
          enemy.isDead = false;
          enemy.health = enemy.maxHealth;
          enemy.position.copy(enemy.patrolCenter);
          enemy.mesh.position.copy(enemy.position);
          enemy.mesh.visible = true;
        }
        continue;
      }

      // Spin rotors
      enemy.rotors.forEach((r, idx) => {
        r.rotation.y += 35 * delta * (idx % 2 === 0 ? 1 : -1);
      });

      const distToPlayer = enemy.position.distanceTo(playerPhysics.position);

      if (!this.isPlayerDead && distToPlayer < 120) {
        // --- COMBAT PURSUIT & ENGAGEMENT MODE ---
        const dirToPlayer = new THREE.Vector3().subVectors(playerPhysics.position, enemy.position).normalize();
        
        // Aim smoothly towards player
        const targetRotationY = Math.atan2(dirToPlayer.x, dirToPlayer.z);
        enemy.rotation.y = THREE.MathUtils.lerp(enemy.rotation.y, targetRotationY, delta * 3.5);
        enemy.mesh.rotation.y = enemy.rotation.y;

        // Keep distance (~25-40m) & match altitude
        const desiredDistance = 30;
        let speed = 12;
        if (distToPlayer > desiredDistance + 5) {
          enemy.position.addScaledVector(dirToPlayer, speed * delta);
        } else if (distToPlayer < desiredDistance - 5) {
          enemy.position.addScaledVector(dirToPlayer, -speed * 0.6 * delta);
        }

        // Smooth Altitude alignment
        enemy.position.y = THREE.MathUtils.lerp(enemy.position.y, playerPhysics.position.y + 1.5, delta * 2.0);

        // Firing logic
        enemy.fireCooldown -= delta;
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(enemy.mesh.rotation);
        const aimAlignment = forward.dot(dirToPlayer);

        if (enemy.fireCooldown <= 0 && aimAlignment > 0.88 && distToPlayer < 90) {
          this._fireEnemyLaser(enemy.position, playerPhysics.position, enemy.velocity);
          enemy.fireCooldown = 1.8 + Math.random() * 1.2;
        }
      } else {
        // --- PATROL ROAMING MODE ---
        enemy.patrolAngle += delta * 0.45;
        const targetX = enemy.patrolCenter.x + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
        const targetZ = enemy.patrolCenter.z + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;

        const moveDir = new THREE.Vector3(targetX - enemy.position.x, 0, targetZ - enemy.position.z).normalize();
        enemy.position.x += moveDir.x * 10 * delta;
        enemy.position.z += moveDir.z * 10 * delta;
        enemy.rotation.y = Math.atan2(moveDir.x, moveDir.z);
        enemy.mesh.rotation.y = enemy.rotation.y;
      }

      enemy.mesh.position.copy(enemy.position);
    }

    // 3. Update Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.life -= delta;
      const positions = exp.points.geometry.attributes.position.array;

      for (let j = 0; j < exp.velocities.length; j++) {
        positions[j * 3] += exp.velocities[j].x * delta;
        positions[j * 3 + 1] += exp.velocities[j].y * delta;
        positions[j * 3 + 2] += exp.velocities[j].z * delta;
        exp.velocities[j].y -= 9.81 * delta * 0.5; // gravity
      }

      exp.points.geometry.attributes.position.needsUpdate = true;
      exp.points.material.opacity = Math.max(0, exp.life / exp.maxLife);

      if (exp.life <= 0) {
        this.scene.remove(exp.points);
        exp.points.geometry.dispose();
        exp.points.material.dispose();
        this.explosions.splice(i, 1);
      }
    }

    // 4. Player Respawn Handler
    if (this.isPlayerDead) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.isPlayerDead = false;
        this.playerHealth = this.playerMaxHealth;
        playerPhysics.position.set(0, 2, 0);
        playerPhysics.velocity.set(0, 0, 0);
        playerPhysics.rotation.set(0, 0, 0);
        playerPhysics.throttle = 0;
      }
    }

    return {
      hitRegistered,
      playerHitRegistered,
      isDead: this.isPlayerDead,
      respawnCountdown: Math.ceil(this.respawnTimer)
    };
  }

  getRadarEnemies() {
    return this.enemies
      .filter((e) => !e.isDead)
      .map((e) => ({ x: e.position.x, z: e.position.z, y: e.position.y }));
  }

  dispose() {
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.enemies.forEach((e) => this.scene.remove(e.mesh));
    this.explosions.forEach((e) => this.scene.remove(e.points));
    this.projectiles = [];
    this.enemies = [];
    this.explosions = [];
  }
}