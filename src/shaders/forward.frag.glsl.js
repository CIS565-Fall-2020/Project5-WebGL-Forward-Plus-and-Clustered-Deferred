import lightingUtils from './include/lighting.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	uniform sampler2D u_colmap;
	uniform sampler2D u_normap;

	in vec3 v_position;
	in vec3 v_normal;
	in vec2 v_uv;

	out vec4 fragColor;

	${lightingUtils}

	layout (std430, binding = 0) buffer Lights {
		Light lights[];
	} lights;

	void main() {
		vec3 albedo = texture(u_colmap, v_uv).rgb;
		vec3 normap = texture(u_normap, v_uv).xyz;
		vec3 normal = applyNormalMap(v_normal, normap);

		fragColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);

		for (int i = 0; i < ${params.numLights}; ++i) {
			Light light = lights.lights[i];
			float lightDistance = distance(light.position, v_position);
			vec3 L = (light.position - v_position) / lightDistance;

			float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
			float lambertTerm = max(dot(L, normal), 0.0);

			fragColor.xyz += albedo * lambertTerm * light.color * vec3(lightIntensity);
		}

		const vec3 ambientLight = vec3(0.025);
		fragColor.xyz += albedo * ambientLight;
	}
	`;
}
