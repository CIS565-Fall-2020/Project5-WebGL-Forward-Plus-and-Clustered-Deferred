import TextureBuffer from './textureBuffer';
import { mat4, vec4 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  degToRad(degrees) {
    return degrees * (Math.PI / 180);
  };

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    let camSpaceLightPos = [];
    let numLights = scene.lights.length;
    for (let i = 0; i < numLights; i++) {
      // the w component must be 1 for translation part of transformation
      // matrix to be applied
      let pos = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1);
      let pTmp = vec4.create();
      vec4.transformMat4(pTmp, pos, viewMatrix);
      camSpaceLightPos.push(pTmp);
      // we set the w-component to zero to make sure it does not contribute
      // to the dot product later on
      camSpaceLightPos[camSpaceLightPos.length - 1][3] = 0;
    }

    let zSliceThickness = (camera.far - camera.near) / this._zSlices;
    let vFOV = this.degToRad(camera.fov);
    // the aspect ratio is the canvas width / canvas height
    let aspectRatio = camera.aspect;
    let far = camera.far;
    let near = camera.near;
    let hFOV = 2.0 * Math.atan((aspectRatio * far * Math.tan(vFOV / 2)) / far);

    // back plane
    let backPlaneNor = vec4.fromValues(0, 0, -1, 0);
    let backPlaneDist = far;
    // front plane
    let frontPlaneNor = vec4.fromValues(0, 0, 1, 0);
    let frontPlaneDist = near;
    // left plane
    let rotMat = mat4.create();
    mat4.fromYRotation(rotMat, hFOV / 2.0);
    let leftPlaneNor = vec4.create();
    vec4.transformMat4(leftPlaneNor, vec4.fromValues(-1, 0, 0, 0), rotMat);
    // right plane
    mat4.fromYRotation(rotMat, -hFOV / 2.0);
    let rightPlaneNor = vec4.create();
    vec4.transformMat4(rightPlaneNor, vec4.fromValues(1, 0, 0, 0), rotMat);
    // top plane
    mat4.fromXRotation(rotMat, -vFOV / 2.0);
    let topPlaneNor = vec4.create();
    vec4.transformMat4(topPlaneNor, vec4.fromValues(0, -1, 0, 0), rotMat);
    // bottom plane
    mat4.fromXRotation(rotMat, vFOV / 2.0);
    let bottomPlaneNor = vec4.create();
    vec4.transformMat4(bottomPlaneNor, vec4.fromValues(0, 1, 0, 0), rotMat);

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          // i back plane
          let iBackPlaneNor = backPlaneNor;
          let iBackPlaneDist = (z + 1) * zSliceThickness + near;
          // i front plane
          let iFrontPlaneNor = frontPlaneNor;
          let iFrontPlaneDist = z * zSliceThickness + near;
          // i left plane
          mat4.fromYRotation(rotMat, -x * hFOV / this._xSlices);
          let iLeftPlaneNor = vec4.create();
          vec4.transformMat4(iLeftPlaneNor, leftPlaneNor, rotMat);
          // i right plane
          mat4.fromYRotation(rotMat, (this._xSlices - x - 1) * hFOV / this._xSlices);
          let iRightPlaneNor = vec4.create();
          vec4.transformMat4(iRightPlaneNor, rightPlaneNor, rotMat);
          // i top plane
          mat4.fromXRotation(rotMat, (this._ySlices - y - 1) * vFOV / this._ySlices);
          let iTopPlaneNor = vec4.create();
          vec4.transformMat4(iTopPlaneNor, topPlaneNor, rotMat);
          // i bottom plane
          mat4.fromXRotation(rotMat, -y * vFOV / this._ySlices);
          let iBottomPlaneNor = vec4.create();
          vec4.transformMat4(iBottomPlaneNor, bottomPlaneNor, rotMat);

          let lightsPerCluster = 0;
          // clear the list of light indices
          for (let l = 0; l < numLights && lightsPerCluster < MAX_LIGHTS_PER_CLUSTER; l++) {
            let r = scene.lights[l].radius;
            let isInBack = 0;
            let isInFront = 0;
            let isInLeft = 0;
            let isInRight = 0;
            let isInTop = 0;
            let isInBottom = 0;
            // i back plane
            let lPos = camSpaceLightPos[l];
            let distToPlane = vec4.dot(lPos, iBackPlaneNor) + iBackPlaneDist;
            if (distToPlane < -r){
              // on the opposite side of the plane that the normal is on
              // outside of frustum's back plane
              isInBack = -1;
              continue;
            } else if (distToPlane < r) {
              // part of the sphere is on one side of the plane and
              // the other part is on the other side of the plane
              isInBack = 0;
            } else {
              // all of the sphere is on the same side of the sphere
              // as the normal
              isInBack = 1;
            }
            // i front plane
            distToPlane = vec4.dot(lPos, iFrontPlaneNor) + iFrontPlaneDist;
            if (distToPlane < -r){
              isInFront = -1;
              continue;
            } else if (distToPlane < r) {
              isInFront = 0;
            } else {
              isInFront = 1;
            }
            // i left plane
            distToPlane = vec4.dot(lPos, iLeftPlaneNor);
            if (distToPlane < -r){
              isInLeft = -1;
              continue;
            } else if (distToPlane < r) {
              isInLeft = 0;
            } else {
              isInLeft = 1;
            }
            // i right plane
            distToPlane = vec4.dot(lPos, iRightPlaneNor);
            if (distToPlane < -r){
              isInRight = -1;
              continue;
            } else if (distToPlane < r) {
              isInRight = 0;
            } else {
              isInRight = 1;
            }
            // i top plane
            distToPlane = vec4.dot(lPos, iTopPlaneNor);
            if (distToPlane < -r){
              isInTop = -1;
              continue;
            } else if (distToPlane < r) {
              isInTop = 0;
            } else {
              isInTop = 1;
            }
            // i top plane
            distToPlane = vec4.dot(lPos, iBottomPlaneNor);
            if (distToPlane < -r){
              isInBottom = -1;
              continue;
            } else if (distToPlane < r) {
              isInBottom = 0;
            } else {
              isInBottom = 1;
            }
            // the light has passsed all of the tests and this light
            // definitely influences this frustum
            lightsPerCluster++;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, Math.floor(lightsPerCluster / 4)) + (lightsPerCluster % 4)] = l;
          }
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = lightsPerCluster;
        }
      }
    }
    this._clusterTexture.update();
  }
}