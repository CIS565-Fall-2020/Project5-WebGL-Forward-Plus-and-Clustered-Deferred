import { vec4, vec3} from 'gl-matrix';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    var frustumHeight = 2.0 * Math.tan(camera.fov * 3.14159 / 360);
    var frustumWidth = camera.aspect * frustumHeight;
    var frustumDepth = camera.far - camera.near;

    var xStride = frustumWidth / this._xSlices;
    var yStride = frustumHeight / this._ySlices;
    var zStride = frustumDepth / this._zSlices;
    var xStart = -frustumWidth * 0.5;
    var yStart = -frustumHeight * 0.5;

    for (let i = 0; i < scene.lights.length; i++) {
      var pos = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1);
      var radius = scene.lights[i].radius;
      var lpos = vec4.create();
      vec4.transformMat4(lpos, pos, viewMatrix);
      var lightPos = vec3.fromValues(lpos[0], lpos[1], -lpos[2]);
      
      // xMin to xMax
      var xMin = -1, xMax = this._xSlices;

      for (var j = 0; j <= this._xSlices; j++) {
        var offset = xStart + xStride * j;
        var sq = Math.sqrt(offset * offset + 1);
        var normal = vec3.fromValues(1.0 / sq, 0.0, -offset / sq);
        var dotLight = vec3.dot(lightPos, normal);
        if (dotLight < radius && dotLight > -radius) {
          xMin = Math.max(0, j - 1);
          break;
        }
      }

      if (xMin < 0) {
        continue;
      }
      for (var j = xMin + 1; j < this._xSlices; j++) {
        var offset = xStart + xStride * j;
        var sq = Math.sqrt(offset * offset + 1);
        var normal = vec3.fromValues(1.0 / sq, 0.0, -offset / sq);
        var dotLight = vec3.dot(lightPos, normal);
        if (dotLight > radius || dotLight < -radius) {
          xMax = j;
          break;
        }
      }
      
      // yMin to yMax
      var yMin = -1, yMax = this._ySlices;
      for (var j = 0; j <= this._ySlices; j++) {
        var offset = yStart + yStride * j;
        var sq = Math.sqrt(offset * offset + 1);
        var normal = vec3.fromValues(0.0, 1.0 / sq, -offset / sq);
        var dotLight = vec3.dot(lightPos, normal);
        if (dotLight < radius && dotLight > -radius) {
          yMin = Math.max(0, j - 1);
          break;
        }
      }

      if (yMin < 0) {
        continue;
      }
      for (var j = yMin + 1; j < this._ySlices; j++) {
        var offset = yStart + yStride * j;
        var sq = Math.sqrt(offset * offset + 1);
        var normal = vec3.fromValues(0.0, 1.0 / sq, -offset / sq);
        var dotLight = vec3.dot(lightPos, normal);
        if (dotLight > radius || dotLight < -radius) {
          yMax = j;
          break;
        }
      }
      
      // zMin to zMax
      var zMin = Math.floor((lightPos[2] - radius - camera.near) / zStride);
      if (zMin >= this._zSlices) {
        continue;
      }
      var zMax = Math.floor((lightPos[2] + radius - camera.near) / zStride);
      if (zMax < 0) {
        continue;
      }
      zMin = Math.max(0, zMin);
      zMax = Math.min(this._zSlices - 1, zMax);
      
      for (let z = zMin; z <= zMax; ++z) {
        for (let y = yMin; y < yMax; ++y) {
          for (let x = xMin; x < xMax; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)];

            count++;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, Math.floor(count / 4)) + count % 4] = i;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] = count;
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}