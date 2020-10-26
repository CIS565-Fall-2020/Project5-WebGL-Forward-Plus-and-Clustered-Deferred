import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
	constructor(xSlices, ySlices, zSlices) {
		this._xSlices = xSlices;
		this._ySlices = ySlices;
		this._zSlices = zSlices;
	}
}
