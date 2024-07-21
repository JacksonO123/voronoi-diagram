@group(1) @binding(0) var<storage> dotPositions: array<vec2f>;

@group(1) @binding(1) var<storage> dotColors: array<vec4f>;

@group(1) @binding(2) var<storage> maxRadius: f32;

const PI = radians(180);

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) fragColor: vec4<f32>,
  @location(1) fragPosition: vec2<f32>,
}

@vertex
fn vertex_main_2d(
  @builtin(instance_index) instanceIdx: u32,
  @location(0) position: vec3f,
  @location(1) color: vec4f,
) -> VertexOutput {
  var output: VertexOutput;

  output.Position = uniforms.orthoProjectionMatrix * vec4(position, 1);
  output.fragPosition = position.xy;
  output.fragColor = color;
  return output;
}

@fragment
fn fragment_main(
  @location(0) fragColor: vec4f,
  @location(1) fragPosition: vec2f
) -> @location(0) vec4f {
  var dotDist: f32 = 0;
  var dotIndex: u32 = 0;

  let numDots = arrayLength(&dotPositions);
  for (var i: u32 = 0; i < numDots; i++) {
    var distance: f32 = distance(fragPosition, dotPositions[i]);

    if (i == 0) {
      dotDist = distance;
    } else if (dotDist > distance) {
      dotDist = distance;
      dotIndex = i;
    }

    if (distance < ${dotRadius}) {
      return vec4(0.0, 0.0, 0.0, 1.0);
    }
  }

  var dot2Dist: f32 = -1;
  var dot2Index: u32 = 0;

  for (var i: u32 = 0; i < numDots; i++) {
    if (i == dotIndex) {
      continue;
    }

    let diffX = fragPosition.x - dotPositions[i].x;
    let diffY = fragPosition.y - dotPositions[i].y;
    var distance = sqrt(diffX * diffX + diffY * diffY);

    if (dot2Dist == -1 || distance < dot2Dist) {
      dot2Dist = distance;
      dot2Index = i;
    }
  }

  let dirVec = (dotPositions[dot2Index] - dotPositions[dotIndex]) / 2;
  let inverseVec = vec2(-dirVec.y, dirVec.x);
  let avgPoint = dotPositions[dotIndex] + dirVec;
  let pixelVec = avgPoint - fragPosition;
  var angle = acos(dot(inverseVec, pixelVec) / (length(inverseVec) * length(pixelVec)));
  if (angle > PI) {
    angle -= PI;
  }

  let dist = asin(angle) * length(pixelVec);
  let temp = dist / 20;
  return vec4(temp, temp, temp, 1.0);

  if (dist < 0) {
    return vec4(1.0, 0.0, 0.0, 1.0);
  }

  if (dist < 15) {
    return vec4(0.0, 0.0, 0.0, 1.0);
  }

  if (dotDist < maxRadius) {
    return dotColors[dotIndex];
  } else {
    return vec4(1.0, 1.0, 1.0, 1.0);
  }
}
