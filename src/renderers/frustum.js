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
