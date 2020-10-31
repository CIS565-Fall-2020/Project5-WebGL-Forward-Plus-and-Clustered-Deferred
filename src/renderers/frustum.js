import { vec3, vec4 } from 'gl-matrix';

class Plane {

	// Define planes by their normal and their distance from the origin
	// (along their normal), according to the equation 
	// Ax + By + Cz + D = 0;
	constructor(p1, p2, p3) {
		// Let p2 - p1 and p3 - p1 define two vectors on the plane, where their
		// cross product is the plane's normal.
		this._pointOnPlane = vec3.fromValues(p1[0], p1[1], p1[2]);

		let p1p2 = vec3.create(),
			p1p3 = vec3.create();

		vec3.subtract(p1p2, p2, p1);
		vec3.subtract(p1p3, p3, p1);

		// corresponds to A, B, C
		let normal = vec3.create();
		vec3.cross(normal, p1p2, p1p3);

		this._normal = normal;

		// corresponds to D
		this._distance = -normal[0] * p1[0] - normal[1] * p1[1] - normal[2] * p1[2];
	}
}

export default class Frustum {
	// points order: top left, top right, bottom right, bottom left
	constructor(fPointsNear, fPointsFar) {
		let tln = fPointsNear[0],
			trn = fPointsNear[1],
			brn = fPointsNear[2],
			bln = fPointsNear[3];

		let tlf = fPointsFar[0],
			trf = fPointsFar[1],
			brf = fPointsFar[2],
			blf = fPointsFar[3];

		this._pointsNear = [vec3.fromValues(tln[0], tln[1], tln[2]),
							vec3.fromValues(trn[0], trn[1], trn[2]),
							vec3.fromValues(brn[0], brn[1], brn[2]),
							vec3.fromValues(bln[0], bln[1], bln[2])];

		this._pointsFar =  [vec3.fromValues(tlf[0], tlf[1], tlf[2]),
							vec3.fromValues(trf[0], trf[1], trf[2]),
							vec3.fromValues(brf[0], brf[1], brf[2]),
							vec3.fromValues(blf[0], blf[1], blf[2])];


    	// Make planes of frustum out of points.
    	// Order of planes: near, left, top, right, bottom, far
    	this._planes = [];
    	this._planes[0] = new Plane(trn, brn, tln); // near
    	this._planes[1] = new Plane(tln, bln, tlf); // left
    	this._planes[2] = new Plane(trn, tln, trf); // top
    	this._planes[3] = new Plane(brn, trn, brf); // right
    	this._planes[4] = new Plane(brn, brf, bln); // bottom
    	this._planes[5] = new Plane(brf, trf, blf); // far
	}

	// taken from https://www.flipcode.com/archives/Frustum_Culling.shtml
	intersectsSphere(position, radius) {
		let distance = 0,
			plane = undefined;

		for(let i = 0; i < 6; i++) {
			plane = this._planes[i];
			distance = vec3.dot(plane._normal, position) + plane._distance;
			if(distance < -radius) {
				return false;
			}

			if(Math.abs(distance) < radius) {
				return true;
			}
			
		}

		return true;
	}

	getTopLeftNear() {
		let tln = this._pointsNear[0];
		return [tln[0], tln[1], tln[2]];
	}

	getTopRightNear() {
		let trn = this._pointsNear[1];
		return [trn[0], trn[1], trn[2]];
	}

	getBottomRightNear() {
		let brn = this._pointsNear[2];
		return [brn[0], brn[1], brn[2]];
	}

	getBottomLeftNear() {
		let bln = this._pointsNear[3];
		return [bln[0], bln[1], bln[2]];
	}

	getTopLeftFar() {
		let tlf = this._pointsFar[0];
		return [tlf[0], tlf[1], tlf[2]];
	}

	getTopRightFar() {
		let trf = this._pointsFar[1];
		return [trf[0], trf[1], trf[2]];
	}

	getBottomRightFar() {
		let brf = this._pointsFar[2];
		return [brf[0], brf[1], brf[2]];
	}

	getBottomLeftFar() {
		let blf = this._pointsFar[3];
		return [blf[0], blf[1], blf[2]];
	}

}