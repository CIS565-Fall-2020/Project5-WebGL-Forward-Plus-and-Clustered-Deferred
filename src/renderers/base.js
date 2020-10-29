import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene.js';
import { vec3, vec4, mat4 } from 'gl-matrix';

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

        let zSide = camera.far - camera.near;
        let subFrustumDepth = zSide / this._zSlices;
        let ySide = Math.tan(camera.fov / 2 * Math.PI / 180) * 2;
        let subFrustumY = ySide / this._ySlices;
        let xSide = camera.aspect * ySide;
        let subFrustumX = xSide / this._xSlices;

        let cameraPos = vec3.fromValues(camera.position.x, camera.position.y, camera.position.z);

        let viewStartY = (90 - camera.fov / 2) * Math.PI / 180;
        let viewEndY = (90 + camera.fov / 2) * Math.PI / 180;
        let viewStartX = Math.PI / 2 - Math.atan(xSide / 2);
        let viewEndX = Math.PI / 2 + Math.atan(xSide / 2);

        for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
            let light = scene.lights[lightIdx];
            let radius = light.radius;

            // Get light position in camera space
            let lightPosWorld = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1.0);
            let lightPosCamera = vec4.create();
            vec4.transformMat4(lightPosCamera, lightPosWorld, viewMatrix);
            lightPosCamera[2] = -lightPosCamera[2];
            if (lightPosCamera[2] + radius < camera.near) {
                continue;
            }
            if (lightPosCamera[2] - radius > camera.far) {
                continue;
            }

            let startZ = Math.max(0, Math.min(this._zSlices - 1, Math.floor((lightPosCamera[2] - radius - camera.near) / subFrustumDepth)));
            let endZ = Math.max(0, Math.min(this._zSlices - 1, Math.floor((lightPosCamera[2] + radius - camera.near) / subFrustumDepth)));
            let startX = 0;
            let endX = this._xSlices - 1;
            let startY = 0;
            let endY = this._ySlices - 1;

            // xz plane
            let distToCam = Math.sqrt(lightPosCamera[0] * lightPosCamera[0] + lightPosCamera[2] * lightPosCamera[2]);
            if (distToCam > radius) {
                let theta = Math.asin(radius / distToCam);
                let alpha = Math.acos(lightPosCamera[2] / distToCam);
                if (lightPosCamera[0] >= 0) {
                    alpha += Math.PI / 2;
                }
                else {
                    alpha = Math.PI / 2 - alpha;
                }
                let lower = alpha - theta;
                let upper = alpha + theta;
                if (lower > viewEndX) {
                    startX = - 1;
                }
                else if (lower < viewStartX) {
                    startX = 0;
                }
                else if (lower > Math.PI / 2) {
                    startX = Math.floor((Math.tan(lower - Math.PI / 2) + xSide / 2) / subFrustumX);
                }
                else {
                    startX = Math.floor((xSide / 2 - Math.tan(Math.PI / 2 - lower)) / subFrustumX);
                }

                if (upper > viewEndX) {
                    endX = this._xSlices - 1;
                }
                else if (upper < viewStartX) {
                    endX = -1;
                }
                else if (upper > Math.PI / 2) {
                    endX = Math.floor((Math.tan(upper - Math.PI / 2) + xSide / 2) / subFrustumX);
                }
                else {
                    endX = Math.floor((xSide / 2 - Math.tan(Math.PI / 2 - upper)) / subFrustumX);
                }
            }
            // yz plane
            distToCam = Math.sqrt(lightPosCamera[1] * lightPosCamera[1] + lightPosCamera[2] * lightPosCamera[2]);
            if (distToCam > radius) {
                let theta = Math.asin(radius / distToCam);
                let alpha = Math.acos(lightPosCamera[2] / distToCam);
                if (lightPosCamera[1] >= 0) {
                    alpha += Math.PI / 2;
                }
                else {
                    alpha = Math.PI / 2 - alpha;
                }
                let lower = alpha - theta;
                let upper = alpha + theta;
                if (lower > viewEndY) {
                    startY = - 1;
                }
                else if (lower < viewStartY) {
                    startY = 0;
                }
                else if (lower > Math.PI / 2) {
                    startY = Math.floor((Math.tan(lower - Math.PI / 2) + ySide / 2) / subFrustumY);
                }
                else {
                    startY = Math.floor((ySide / 2 - Math.tan(Math.PI / 2 - lower)) / subFrustumY);
                }

                if (upper > viewEndY) {
                    endY = this._ySlices - 1;
                }
                else if (upper < viewStartY) {
                    endY = -1;
                }
                else if (upper > Math.PI / 2) {
                    endY = Math.floor((Math.tan(upper - Math.PI / 2) + ySide / 2) / subFrustumY);
                }
                else {
                    endY = Math.floor((ySide / 2 - Math.tan(Math.PI / 2 - upper)) / subFrustumY);
                }
            }

            if (startX == -1 || endX == -1 || startY == -1 || endY == -1) {
                continue;
            }

            for (let z = startZ; z <= endZ; z++) {
                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        let cid = z * this._xSlices * this._ySlices + y * this._xSlices + x;
                        let bid = this._clusterTexture.bufferIndex(cid, 0);
                        if (this._clusterTexture.buffer[bid] < MAX_LIGHTS_PER_CLUSTER) {
                            this._clusterTexture.buffer[bid] += 1;
                            let tmp = this._clusterTexture.buffer[bid];
                            let nextLight = this._clusterTexture.bufferIndex(cid, Math.floor(tmp / 4)) + Math.floor(tmp % 4);
                            this._clusterTexture.buffer[nextLight] = lightIdx;
                        }
                    }
                }
            }
        }

        this._clusterTexture.update();
    }
}