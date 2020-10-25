vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
	normap = normap * 2.0 - 1.0;
	vec3 up = normalize(vec3(0.001, 1, 0.001));
	vec3 surftan = normalize(cross(geomnor, up));
	vec3 surfbinor = cross(geomnor, surftan);
	return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

struct Light {
	vec3 position;
	float radius;
	vec3 color;
	float _padding;
};

// Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
float cubicGaussian(float h) {
	if (h < 1.0) {
		return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
	} else if (h < 2.0) {
		return 0.25 * pow(2.0 - h, 3.0);
	} else {
		return 0.0;
	}
}
