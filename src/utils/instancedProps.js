import * as THREE from 'three';

/**
 * Builds a single InstancedMesh from a geometry/material + an array of
 * transforms (as produced by scatterOnTerrain or custom placement logic).
 *
 * transforms: Array<{ x, y, z, rotationY, scale }>
 *
 * Manually computes a bounding sphere that encompasses ALL instance
 * positions — THREE's default bounding sphere is based only on the
 * base geometry at the origin, which causes incorrect frustum culling
 * (props popping out of view) once instances are spread across a large
 * terrain. This fixes that.
 *
 * Returns { mesh, dispose() }
 */
export function createInstancedProps({
  geometry,
  material,
  transforms,
  castShadow = true,
  receiveShadow = false,
}) {
  const count = transforms.length;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;

  const dummy = new THREE.Object3D();
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const t = transforms[i];
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, t.rotationY || 0, 0);
    dummy.scale.setScalar(t.scale || 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
    minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
    minZ = Math.min(minZ, t.z); maxZ = Math.max(maxZ, t.z);
  }

  mesh.instanceMatrix.needsUpdate = true;

  const center = new THREE.Vector3(
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2
  );
  const radius = count > 0
    ? center.distanceTo(new THREE.Vector3(maxX, maxY, maxZ)) + 10
    : 1;
  mesh.geometry.boundingSphere = new THREE.Sphere(center, radius);
  mesh.frustumCulled = true;

  function dispose() {
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }

  return { mesh, dispose };
}

/**
 * Basic per-instance distance culling. Call this periodically (not
 * necessarily every frame — every ~10 frames is plenty) with the
 * player/camera position. Instances beyond maxDistance get collapsed
 * to zero scale (effectively invisible, still "exists" but cheap to
 * rasterize). This is a simple stand-in for real LOD — swap-geometry
 * LOD can replace this later if perf demands it.
 */
export function updateInstancedCulling(instancedMeshEntry, transforms, cameraPos, maxDistance) {
  const { mesh } = instancedMeshEntry;
  const dummy = new THREE.Object3D();
  const maxDistSq = maxDistance * maxDistance;

  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    const dx = t.x - cameraPos.x;
    const dz = t.z - cameraPos.z;
    const distSq = dx * dx + dz * dz;

    const visible = distSq <= maxDistSq;
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, t.rotationY || 0, 0);
    dummy.scale.setScalar(visible ? (t.scale || 1) : 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
/**
 * Like createInstancedProps, but distributes a single transforms array
 * across multiple geometry variants (round-robin) so instanced clusters
 * don't look like one shape cloned repeatedly. Returns an array of
 * { mesh, dispose } entries — add each .mesh to the scene.
 */
export function createInstancedPropVariants({
  geometries,
  material,
  transforms,
  castShadow = true,
  receiveShadow = false,
}) {
  const buckets = geometries.map(() => []);
  transforms.forEach((t, i) => {
    buckets[i % geometries.length].push(t);
  });

  return buckets
    .map((bucketTransforms, i) => {
      if (bucketTransforms.length === 0) return null;
      return createInstancedProps({
        geometry: geometries[i],
        material,
        transforms: bucketTransforms,
        castShadow,
        receiveShadow,
      });
    })
    .filter(Boolean);
}