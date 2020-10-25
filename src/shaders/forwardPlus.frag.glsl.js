import lightingUtils from './include/lighting.glsl'
import frustumUtils from './include/frustum.glsl'

export default function(params) {
	return `#version 310 es
	precision highp float;

	uniform sampler2D u_colmap;
	uniform sampler2D u_normap;

	uniform uint u_blockSize;
	uniform uint u_numBlocksX;

	uniform int u_debugMode;
	uniform float u_debugModeParam;

	in vec3 v_position;
	in vec3 v_normal;
	in vec2 v_uv;

	out vec4 fragColor;

	${lightingUtils}

	layout (std430, binding = 0) buffer LightIn {
		Light lights[];
	} lights;
	layout (std430, binding = 1) buffer LightList {
		ivec2 node[];
	} list;
	layout (std430, binding = 2) buffer LightHead {
		int head[];
	} head;

	${frustumUtils}

	void main() {
		vec3 albedo = texture(u_colmap, v_uv).rgb;
		vec3 normap = texture(u_normap, v_uv).xyz;
		vec3 normal = applyNormalMap(v_normal, normap);

		fragColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);

		uvec2 blockIndex = uvec2(gl_FragCoord.xy) / u_blockSize;
		uint index = blockIndex.y * u_numBlocksX + blockIndex.x;
		int count = 0;
		for (int i = head.head[index + 1u]; i != -1; i = list.node[i].y) {
			Light light = lights.lights[list.node[i].x];
			float lightDistance = distance(light.position, v_position);
			vec3 L = (light.position - v_position) / lightDistance;

			float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
			float lambertTerm = max(dot(L, normal), 0.0);

			fragColor.xyz += albedo * lambertTerm * light.color * vec3(lightIntensity);
			count += 1;
		}

		const vec3 ambientLight = vec3(0.025);
		fragColor.xyz += albedo * ambientLight;
		if (u_debugMode == 2) {
			fragColor.xyz = mix(
				vec3(0.0f, 0.0f, 1.0f),
				vec3(1.0f, 0.0f, 0.0f),
				float(count) / (u_debugModeParam * 1000.0f + 1.0f)
			);
		}
	}
	`;
}
