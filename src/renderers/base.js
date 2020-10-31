import TextureBuffer from './textureBuffer';
import Frustum from './frustum'
import { mat4, vec4 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = NUM_LIGHTS;

function clampValue(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._frustums = [];
  }

  updateClusters(camera, view, viewProjectionMatrix, scene) {

    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    let inverseVP = mat4.create();
    mat4.invert(inverseVP, viewProjectionMatrix);

    let frustums = this._frustums;
    let clusterLists = [];

    let cw = canvas.width,
        ch = canvas.height;

    let xSlices = this._xSlices,
        ySlices = this._ySlices,
        zSlices = this._zSlices;

    // Optimized: iterate over all lights and use their AABBs
    // to test less frustums
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
          clusterLists[i] = [];
        }
      }
    }

    for(let l = 0; l < scene.lights.length; l++) {
      let light = scene.lights[l];
      let pos = light.position;
      let r = light.radius + 5;
      // The bounding box is imperfect, so we need to give it some cushion

      // get the AABB in world space
      let boundMin = vec4.fromValues(pos[0] - r, pos[1] - r, pos[2] - r, 1),
          boundMax = vec4.fromValues(pos[0] + r, pos[1] + r, pos[2] + r, 1);

      // calculate z-slices in projected space
      let zDist = camera.far - camera.near;

      let cameraBoundMin = vec4.create(),
          cameraBoundMax = vec4.create();
      vec4.transformMat4(cameraBoundMin, boundMin, view);
      vec4.transformMat4(cameraBoundMax, boundMax, view);

      let zSliceMin = clampValue(Math.floor(cameraBoundMin[2] / zDist * zSlices), 0, zSlices),
          zSliceMax = clampValue(Math.ceil(cameraBoundMax[2] / zDist * zSlices), 0, zSlices);
      
      let transformedBoundMin = vec4.create();
      let transformedBoundMax = vec4.create();
      vec4.transformMat4(transformedBoundMin, boundMin, viewProjectionMatrix);
      vec4.transformMat4(transformedBoundMax, boundMax, viewProjectionMatrix);

      let xSliceMin = (transformedBoundMin[0] + 1) / 2 * xSlices,
          xSliceMax = (transformedBoundMax[0] + 1) / 2 * xSlices;

      xSliceMin = clampValue(Math.floor(xSliceMin), 0, xSlices);
      xSliceMax = clampValue(Math.ceil(xSliceMax), 0, xSlices);

      let ySliceMin = (transformedBoundMin[1] + 1) / 2 * ySlices,
          ySliceMax = (transformedBoundMax[1] + 1) / 2 * ySlices;

      ySliceMin = clampValue(Math.floor(ySliceMin), 0, ySlices);
      ySliceMax = clampValue(Math.ceil(ySliceMax), 0, ySlices);

      for (let z = zSliceMin; z <= zSliceMax; ++z) {
        for (let y = ySliceMin; y <= ySliceMax; ++y) {
          for (let x = xSliceMin; x < xSliceMax; ++x) {
            let i = x + y * xSlices + z * xSlices * ySlices;
            clusterLists[i].push(l);
          }
        }
      }
    }

    for(let i = 0; i < xSlices * ySlices * zSlices; i++) {
      if(clusterLists[i].length == 0) continue;
      let pixelNum = 0;
      let compNum = 1;
      let lights = clusterLists[i];
      this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lights.length;
      for(let j = 0; j < lights.length; j++) {
        this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, pixelNum) + compNum] = lights[j];
        compNum++;
        if(compNum >= 4) {
          compNum = 0;
          pixelNum++;
        }
      }
    }
/*
    // NAIVE: iterate over all frustums, for each: test against each light
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          let px = cw * x / xSlices,
              px1 = cw * (x + 1) / xSlices,
              py = ch * y / ySlices,
              py1 = ch * (y + 1) / ySlices,
              pz = 0.01,
              pz1 = 1;

          // generate a frustum for this slice
            let points =   [  vec4.fromValues(px,  py1, pz, 1),
                              vec4.fromValues(px1, py1, pz, 1),
                              vec4.fromValues(px1, py,  pz, 1),
                              vec4.fromValues(px,  py,  pz, 1),
                              vec4.fromValues(px,  py1, pz1, 1),
                              vec4.fromValues(px1, py1, pz1, 1),
                              vec4.fromValues(px1, py,  pz1, 1),
                              vec4.fromValues(px,  py,  pz1, 1)  ];

            // Transform pixel coordinates of frustum on far clip to world space
            for(let j = 0; j < 8; j++) {
              let sx = (points[j][0] / cw) * 2 - 1;
              let sy = 1 - (points[j][1] / ch) * 2;

              let uvec = vec4.fromValues(sx, sy, points[j][2], points[j][3]);
              vec4.transformMat4(points[j], uvec, inverseVP);
              vec4.scale(points[j], points[j], 1 / points[j][3])
            }

            // Calculate the Z values of the intermediary z-slices, based on the full frustum
            let zScaleN = z / zSlices,
                zScaleF = (z + 1) / zSlices;

            for(let j = 0; j < 4; j++) {
              let nearToFar = vec4.create();
              vec4.subtract(nearToFar, points[j + 4], points[j]);
              let tempNear = vec4.fromValues(zScaleN * nearToFar[0],
                                             zScaleN * nearToFar[1],
                                             zScaleN * nearToFar[2],
                                             1);

              let tempFar = vec4.fromValues(zScaleF * nearToFar[0],
                                            zScaleF * nearToFar[1],
                                            zScaleF * nearToFar[2],
                                            1);
              vec4.copy(points[j], tempNear);
              vec4.copy(points[j + 4], tempFar);
            }

            // Generate a new frustum
            frustums[i] = new Frustum([points[0], points[1], points[2], points[3]],
                                      [points[4], points[5], points[6], points[7]]);

            let lights = [];

            for(let l = 0; l < scene.lights.length; l++) {
              let light = scene.lights[l];
              let pos = light.position;
              let r = light.radius;
              if(frustums[i].intersectsSphere(pos, r)) {
                lights[lights.length] = l;
              }
            }

          let pixelNum = 0;
          let compNum = 1;

          // stores it vertically; each index horizontal is a new cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lights.length;
          for(let j = 0; j < lights.length; j++) {
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, pixelNum) + compNum] = lights[j];
            compNum++;
            if(compNum >= 4) {
              compNum = 0;
              pixelNum++;
            }
          }
        }
      }
    }*/

    this._clusterTexture.update();
  }
}