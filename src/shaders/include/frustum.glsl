struct Frustum {
	vec3 bottomLeft, topRight;
	float near, far;
};

Frustum computeFrustum(
	float camRight, float camUp, uvec2 screenSize, uvec2 bottomLeft, uvec2 topRight, float near, float far
) {
	Frustum result;
	vec2 bottomLeftPerc = 2.0f * vec2(bottomLeft) / vec2(screenSize) - 1.0f;
	vec2 topRightPerc = 2.0f * vec2(topRight) / vec2(screenSize) - 1.0f;
	result.bottomLeft = vec3(camRight * bottomLeftPerc.x, camUp * bottomLeftPerc.y, 1.0f);
	result.topRight = vec3(camRight * topRightPerc.x, camUp * topRightPerc.y, 1.0f);
	result.near = near;
	result.far = far;
	return result;
}

float depthSampleToWorld(float depth, float near, float far) {
	return near * far / (far - depth * (far - near));
}

bool FrustumSphereIntersectionPossible(Frustum fr, vec3 center, float radius) {
	if (center.z + radius < fr.near || center.z - radius > fr.far) {
		return false;
	}

	if (dot(normalize(cross(fr.topRight, vec3(0.0f, -1.0f, 0.0f))), center) > radius) {
		return false;
	}
	if (dot(normalize(cross(fr.topRight, vec3(1.0f, 0.0f, 0.0f))), center) > radius) {
		return false;
	}

	if (dot(normalize(cross(fr.bottomLeft, vec3(0.0f, 1.0f, 0.0f))), center) > radius) {
		return false;
	}
	if (dot(normalize(cross(fr.bottomLeft, vec3(-1.0f, 0.0f, 0.0f))), center) > radius) {
		return false;
	}

	return true;
}
