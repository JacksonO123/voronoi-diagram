import {
  Camera,
  Color,
  Simulation,
  Square,
  Vector2,
  frameLoop,
  randomInt,
  vector2,
  vector3,
  vec2,
  randomColor,
  Line2d,
  vertex,
  color,
  transitionValues,
  easeInQuart,
  easeOutQuart,
  Shader,
  writeUniformWorldMatrix,
  defaultShader,
  createBindGroup
} from 'simulationjsv2';

// const showFps = true;
const showFps = false;

const canvas = new Simulation('canvas', new Camera(vector3()), showFps);
canvas.fitElement();
canvas.start();

const startTime = 1500;
const sideBuffer = 400;
const dotRadius = 8;
const maxRadius = 4000;
const speed = 0.4;
const animationTime = 3;
let currentRadius = dotRadius;

const newShader = `
struct Uniforms {
  worldProjectionMatrix: mat4x4<f32>,
  modelProjectionMatrix: mat4x4<f32>,
}
 
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@group(0) @binding(1) var<storage> dotPositions: array<vec2f>;

@group(0) @binding(2) var<storage> dotColors: array<vec4f>;

@group(0) @binding(3) var<storage> maxRadius: f32;

const PI = radians(180);

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) fragColor: vec4<f32>,
  @location(1) fragPosition: vec2<f32>,
}

@vertex
fn vertex_main(
  @location(0) position: vec3f,
  @location(1) color: vec4f,
) -> VertexOutput {
  var output: VertexOutput;

  output.Position = uniforms.worldProjectionMatrix * uniforms.modelProjectionMatrix * vec4(position, 1.0);
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
  }

  if (dotDist < maxRadius) {
    // return vec4(temp, temp, temp, 1.0);
    return dotColors[dotIndex];
  } else {
    return fragColor;
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

  setColor(color: Color) {
    this.color = color;
  }

  step() {
    const vec = vec2.rotate(vector2(speed), vector2(), this.rotation) as Vector2;
    vec2.add(this.position, vec, this.position);

    const diffScale = 0.0015;
    const diff = this.toRotation - this.rotation;
    this.rotation += diff * diffScale;

    if (Math.abs(this.toRotation - this.rotation) < 0.05) {
      this.toRotation = randomRotation();
    }

    if (this.position[0] < -(dotRadius + sideBuffer + (canvas.getWidth() * devicePixelRatio) / 2)) {
      this.position[0] = (canvas.getWidth() * devicePixelRatio) / 2 + dotRadius + sideBuffer;
    } else if (this.position[0] > (canvas.getWidth() * devicePixelRatio) / 2 + dotRadius + sideBuffer) {
      this.position[0] = -(dotRadius + sideBuffer + (canvas.getWidth() * devicePixelRatio) / 2);
    }

    if (this.position[1] > dotRadius + sideBuffer + (canvas.getHeight() * devicePixelRatio) / 2) {
      this.position[1] = -((canvas.getHeight() * devicePixelRatio) / 2 + dotRadius + sideBuffer);
    } else if (this.position[1] < -((canvas.getHeight() * devicePixelRatio) / 2 + dotRadius + sideBuffer)) {
      this.position[1] = dotRadius + sideBuffer + (canvas.getHeight() * devicePixelRatio) / 2;
    }
  }
}

const dots = generateDots(60);

const voronoiShader = new Shader(
  newShader,
  [
    {
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform'
          }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'read-only-storage'
          }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'read-only-storage'
          }
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'read-only-storage'
          }
        }
      ]
    }
  ],
  [
    {
      format: 'float32x3',
      size: 12
    },
    {
      format: 'float32x4',
      size: 16
    }
  ],
  [
    {
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      owned: false
    },
    {
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      defaultSize: 8
    },
    {
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      defaultSize: 16
    },
    {
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      defaultSize: 4
    }
  ],
  (el, buffers) => {
    const posBuf = new Float32Array(dots.length * 2);
    const colorBuf = new Float32Array(dots.length * 4);

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

    writeUniformWorldMatrix(el);

    buffers[0].write(posBuf);
    buffers[1].write(colorBuf);
    buffers[2].write(new Float32Array([currentRadius]));
  },
  (el, buffers) => {
    const shader = el.getShader();
    const gpuBuffers = [
      el.getUniformBuffer(),
      buffers[0].getBuffer(),
      buffers[1].getBuffer(),
      buffers[2].getBuffer()
    ];

    return [createBindGroup(shader, 0, gpuBuffers)];
  },
  defaultShader.getVertexBufferWriter()
);

const square = new Square(
  vector2(canvas.getWidth() / 2, -canvas.getHeight() / 2),
  canvas.getWidth(),
  canvas.getHeight(),
  color()
);
square.setShader(voronoiShader);
canvas.add(square);

canvas.onResize((width, height) => {
  square.setWidth(width);
  square.setHeight(height);
});

let running = true;
// let running = false;
let animating = false;

function init() {
  currentRadius = dotRadius;

  return new Promise<void>((resolve) => {
    setTimeout(async () => {
      await transitionValues(
        (a) => {
          currentRadius += maxRadius * a;
        },
        () => {
          currentRadius = maxRadius;
        },
        animationTime,
        easeInQuart
      );
      resolve();
    }, startTime);
  });
}

async function main() {
  animating = true;
  await init();
  animating = false;
}

main();

async function shrinkDots() {
  const diff = dotRadius - maxRadius;

  return transitionValues(
    (a) => {
      currentRadius += diff * a;
    },
    () => {
      currentRadius = dotRadius;
    },
    animationTime,
    easeOutQuart
  );
}

async function restart() {
  animating = true;
  await shrinkDots();
  await init();
  animating = false;
}

addEventListener('keypress', (e) => {
  if (e.key === ' ') {
    running = !running;
  } else if (e.key === 'Enter' && !animating) {
    restart();
  }
});

const line = new Line2d(vertex(), vertex(), 5);
canvas.add(line);

const line2 = new Line2d(vertex(0, 0, 0, color(0, 0, 255)), vertex(), 5);
canvas.add(line2);

const line3 = new Line2d(vertex(0, 0, 0, color(0, 255)), vertex(), 5);
canvas.add(line3);

const line4 = new Line2d(vertex(0, 0, 0, color(255)), vertex(), 5);
canvas.add(line4);

frameLoop(() => {
  if (running) {
    for (let i = 0; i < dots.length; i++) {
      dots[i].step();
    }
  }
})();

function generateDots(nums: number) {
  const dots: Dot[] = [];

  for (let i = 0; i < nums; i++) {
    const color = randomColor();
    const width = canvas.getWidth() * devicePixelRatio;
    const height = canvas.getHeight() * devicePixelRatio;
    const vec = vector2(
      randomInt(width + sideBuffer * 2) - sideBuffer - width / 2,
      -randomInt(height + sideBuffer * 2) + sideBuffer + height / 2
    );
    const dot = new Dot(vec, color);
    dots.push(dot);
  }

  return dots;
}

function randomRotation() {
  return Math.random() * Math.PI * 2;
}
