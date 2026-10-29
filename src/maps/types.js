/**
 * Map Module Contract
 * --------------------
 * Every file at src/maps/<id>/index.js must export a default object
 * matching this shape. App.jsx only ever talks to this interface —
 * it never knows the specifics of any individual biome.
 *
 * generateTerrain(scene, THREE)
 *    -> { mesh, getHeightAt(x, z) }
 *       Builds and adds the ground mesh to the scene.
 *       getHeightAt is used later for prop placement and
 *       (eventually) ground-collision in DronePhysics.
 *
 * generateProps(scene, THREE, getHeightAt)
 *    -> disposables: Array<Object3D | InstancedMesh>
 *       Builds trees/buildings/rocks/etc, placed using getHeightAt
 *       so they sit correctly on non-flat terrain.
 *
 * generateAtmosphere(scene, THREE)
 *    -> { update(delta, elapsed), dispose() }
 *       Particles, fog pulse, lightning, sky dome, clouds — anything
 *       that needs a per-frame update.
 *
 * generateHazards(scene, THREE)
 *    -> hazardZones: Array<{ x, z, radius, type }>
 *       Consumed by CombatManager for environmental damage.
 *
 * ambienceTrackId: string | null
 *    Passed to EngineSound.playAmbience(trackId).
 *
 * dispose(scene)
 *    Tears down everything this module added (called on map switch).
 */

// Factory that fills in safe no-op defaults for any field a map
// hasn't implemented yet, so partial modules don't crash the loader
// during the Phase 2 migration.
export function createMapModule(overrides = {}) {
    return {
      generateTerrain: () => ({ mesh: null, getHeightAt: () => 0 }),
      generateProps: () => [],
      generateAtmosphere: () => ({ update: () => {}, dispose: () => {} }),
      generateHazards: () => [],
      ambienceTrackId: null,
      dispose: () => {},
      ...overrides,
    };
  }