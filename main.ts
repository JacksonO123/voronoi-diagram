import {
  Camera,
  Color,
  ShaderGroup,
  Simulation,
  Square,
  Vector2,
  colorf,
  frameLoop,
  randomInt,
  vector2,
  vector3,
  vec2,
  randomColor,
} from "simulationjsv2";

const canvas = new Simulation("canvas", new Camera(vector3()), true);
canvas.fitElement();
canvas.start();

const sideBuffer = 400;
const dotRadius = 8;
const radiusSpeed = 2;
const maxRadius = canvas.getWidth() * devicePixelRatio;
const speed = 0.4;
let currentRadius = 0;

const newShader = `
@group(1) @binding(0) var<storage> dotPositions: array<vec2f>;
@group(1) @binding(1) var<storage> dotColors: array<vec4f>;
@group(1) @binding(2) var<storage> maxRadius: f32;

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) fragColor: vec4<f32>,
  @location(1) fragPosition: vec4<f32>,
}

@vertex
fn vertex_main_2d(
  @builtin(instance_index) instanceIdx: u32,
  @location(0) position: vec3f,
  @location(1) color: vec4f,
) -> VertexOutput {
  var output: VertexOutput;

  output.Position = uniforms.orthoProjectionMatrix * vec4(position, 1);
  output.fragPosition = vec4(position, 1);
  // output.fragPosition = output.Position;
  output.fragColor = color;
  return output;
}

@fragment
fn fragment_main(
  @location(0) fragColor: vec4f,
  @location(1) fragPosition: vec4f
) -> @location(0) vec4f {
  var dotDist: f32 = 0;
  var dotIndex: u32 = 0;

  let numDots = arrayLength(&dotPositions);
  for (var i: u32 = 0; i < numDots; i++) {
    let diffX = fragPosition.x - dotPositions[i].x;
    let diffY = fragPosition.y - dotPositions[i].y;
    var distance = sqrt(diffX * diffX + diffY * diffY);

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

  if (dotDist < maxRadius) {
    return dotColors[dotIndex];
  } else {
    return vec4(1.0, 1.0, 1.0, 1.0);
  }
}
`;

class Dot {
  private position: Vector2;
  private rotation: number;
  private toRotation: number;
  private color: Color;

  constructor(pos: Vector2, color: Color) {
    this.position = pos;
    this.rotation = randomRotation();
    this.toRotation = randomRotation();
    this.color = color;
  }

  getPosition() {
    return this.position;
  }

  getRotation() {
    return this.rotation;
  }

  getColor() {
    return this.color;
  }

  step() {
    const vec = vec2.rotate(
      vector2(speed),
      vector2(),
      this.rotation,
    ) as Vector2;
    vec2.add(this.position, vec, this.position);

    const diffScale = 0.001;
    const diff = this.toRotation - this.rotation;
    this.rotation += diff * diffScale;

    if (Math.abs(this.toRotation - this.rotation) < 0.05) {
      this.toRotation = randomRotation();
    }

    if (this.position[0] < -(dotRadius + sideBuffer)) {
      this.position[0] =
        canvas.getWidth() * devicePixelRatio + dotRadius + sideBuffer;
    } else if (
      this.position[0] >
      canvas.getWidth() * devicePixelRatio + dotRadius + sideBuffer
    ) {
      this.position[0] = -(dotRadius + sideBuffer);
    }

    if (this.position[1] < -(dotRadius + sideBuffer)) {
      this.position[1] =
        canvas.getHeight() * devicePixelRatio + dotRadius + sideBuffer;
    } else if (
      this.position[1] >
      canvas.getHeight() * devicePixelRatio + dotRadius + sideBuffer
    ) {
      this.position[1] = -(dotRadius + sideBuffer);
    }
  }
}

const dots = generateDots(60);

const group = new ShaderGroup(
  newShader,
  "triangle-strip",
  [
    {
      format: "float32x3",
      size: 12,
    },
    {
      format: "float32x4",
      size: 16,
    },
  ],
  {
    bufferSize: 7,
    createBuffer: (x: number, y: number, z: number, color: Color) => {
      return [x, y, z, ...color.toBuffer()];
    },
    shouldEvaluate: () => false,
  },
  {
    bindings: [
      {
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {
          type: "read-only-storage",
        },
      },
      {
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {
          type: "read-only-storage",
        },
      },
      {
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {
          type: "read-only-storage",
        },
      },
    ],
    values: () => {
      const posBuf = Array(dots.length * 2);
      const colorBuf = Array(dots.length * 4);

      for (let i = 0; i < dots.length; i++) {
        const pos = dots[i].getPosition();
        posBuf[i * 2] = pos[0];
        posBuf[i * 2 + 1] = pos[1];

        const tempBuf = dots[i].getColor().toBuffer();
        colorBuf[i * 4] = tempBuf[0];
        colorBuf[i * 4 + 1] = tempBuf[1];
        colorBuf[i * 4 + 2] = tempBuf[2];
        colorBuf[i * 4 + 3] = 1;
      }

      return [
        {
          value: posBuf,
          array: Float32Array,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        },
        {
          value: colorBuf,
          array: Float32Array,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        },
        {
          value: [currentRadius],
          array: Float32Array,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        },
      ];
    },
  },
);

const square = new Square(
  vector2(),
  canvas.getWidth(),
  canvas.getHeight(),
  colorf(255),
);
group.add(square);
canvas.add(group);

canvas.onResize((width, height) => {
  square.setWidth(width);
  square.setHeight(height);
});

frameLoop(() => {
  for (let i = 0; i < dots.length; i++) {
    dots[i].step();
  }

  if (currentRadius < maxRadius) {
    currentRadius += radiusSpeed;
  }
})();

function generateDots(nums: number) {
  const dots: Dot[] = [];

  for (let i = 0; i < nums; i++) {
    const color = randomColor();
    const dot = new Dot(
      vector2(
        randomInt(canvas.getWidth() * devicePixelRatio + sideBuffer * 2) -
          sideBuffer,
        randomInt(canvas.getHeight() * devicePixelRatio + sideBuffer * 2) -
          sideBuffer,
      ),
      color,
    );
    dots.push(dot);
  }

  return dots;
}

function randomRotation() {
  return Math.random() * Math.PI * 2;
}
