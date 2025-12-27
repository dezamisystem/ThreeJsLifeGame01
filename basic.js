// importmapの定義と紐付け
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';

// ---- エンジン初期化 ----

// 1. シーンの作成
const threeScene = new THREE.Scene();
threeScene.background = new THREE.Color(0x1f1f1f); // 背景色

// 2. カメラの作成
// PerspectiveCamera(視野角, アスペクト比, 近クリップ面, 遠クリップ面)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// カメラ位置（X、Y、Z）
camera.position.set(0, 15, 15);

// 3. レンダラーの作成
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Statsのセットアップ
const stats = new Stats();
document.body.appendChild(stats.dom); // 画面（左上）に追加

// 4. 視点操作の追加
const controls = new OrbitControls(camera, renderer.domElement);
// 慣性の有無
// controls.enableDamping = false;
// if (controls.enableDamping) {
//     controls.dampingFactor = 0.1;
// }

// 5. ウィンドウリサイズ対応イベント
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- ワールド追加 ----

// 6. グリッド線を追加（X軸長さ、Z軸長さ）
const gridHelper = new THREE.GridHelper(24, 24);
threeScene.add(gridHelper);
// XYZ軸を追加（長さ）
const axesHelper = new THREE.AxesHelper(18);
threeScene.add(axesHelper);

// 7. ライトの作成
// 環境光（色、強さ）
const ambientLight = new THREE.AmbientLight(0x7f7f7f, 2);
threeScene.add(ambientLight);
// 平行光源（色、強さ）
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
// 位置（X軸長さ、Y軸長さ、Z軸長さ）
directionalLight.position.set(10, 10, 10);
threeScene.add(directionalLight);

// ---- オブジェクト ----

// セルのマテリアル色を更新
const updateCellMaterialColor = (material, h, alive) => {
    // （色相、彩度、輝度）
    material.color.setHSL(h, 0.9, alive ? 0.75 : 0.05);
};

// 8. 立方体の作成（X軸長さ、Y軸長さ、Z軸長さ）
const geometry = new THREE.BoxGeometry(0.75, 0.75, 0.75);
// エッジの追加（立方体の輪郭を見やすくする）
const edges = new THREE.EdgesGeometry(geometry);
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

// 素体生成関数
const createShape = (x, y, z, alive) => {
    const material = new THREE.MeshStandardMaterial();
    // 初期の輝度
    updateCellMaterialColor(material, 0.0, alive);
    // 素体は立方体
    const cube = new THREE.Mesh(geometry, material);
    cube.userData.currentHue = 0.0;
    // 配置
    cube.position.x = x;
    cube.position.y = y;
    cube.position.z = z;
    // エッジの追加
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    cube.add(wireframe);
    // シーンへ追加
    threeScene.add(cube);
    // 結果
    return cube;
};

// セル数（奇数）
const WORLD_SIZE = 19;

// 銀河パターン
const galaxyLayoutMatrix = [
    [1, 1, 0, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 1, 1]
];

const cellKey = (x, y) => `${x},${y}`;

// 9. 細胞群の初期化
const createCellsMap = (w, h, layoutMatrix) => {
    const layoutRowLength = layoutMatrix.length;
    const layoutColLength = layoutMatrix[0].length;
    // console.log(`layout: ${layoutColLength},${layoutRowLength}`);
    const layoutStartX = (w - layoutColLength) / 2 | 0;
    const layoutStartY = (h - layoutRowLength) / 2 | 0;
    // console.log(`start: (${layoutStartX},${layoutStartY}), length: ${layoutColLength},${layoutRowLength}`);
    const cells = {};
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let cell = {};
            const shapeX = x - (w / 2);
            const shapeZ = y - (h / 2);
            let alive = false;
            if ((y >= layoutStartY && y < layoutStartY + layoutRowLength) && (x >= layoutStartX && x < layoutStartX + layoutColLength)) {
                alive = layoutMatrix[y - layoutStartY][x - layoutStartX] > 0 ? true : false;
            }
            cell.alive = alive;
            cell.shape = createShape(shapeX, 0, shapeZ, alive);
            // 変数追加
            cell.shape.userData.timer = 0.0;
            cell.shape.userData.cellX = x;
            cell.shape.userData.cellY = y;
            // 登録
            const key = cellKey(x, y);
            cells[key] = cell;
        }
    }
    return cells;
};
const cellsMap = createCellsMap(WORLD_SIZE, WORLD_SIZE, galaxyLayoutMatrix);

// ライフゲームロジック
// 生存数
const countAliveNeighbors = (cell) => {
    let result = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) continue; // 自分を除外
            const neighborX = cell.shape.userData.cellX + dx;
            const neighborY = cell.shape.userData.cellY + dy;
            const key = cellKey(neighborX, neighborY);
            // 存在チェック
            if (cellsMap.hasOwnProperty(key)) {
                const neighborCell = cellsMap[key];
                if (neighborCell.alive) {
                    result += 1;
                }
            }
        }
    }
    return result;
};
// 状態更新
const updateAliveFlag = (cell) => {
    // 生存：生きているセルに隣接する生きたセルが2つかまたは3つあれば、生存維持
    // 過疎or過密：上記の条件を満たさない場合は、次の世代で死滅する
    // 誕生：死んでいるセルに隣接する生きたセルがちょうど3つあれば、次の世代で誕生する
    // 過疎or過密：上記の条件を満たさない場合は、次の世代で死滅する
    const aliveCount = countAliveNeighbors(cell);
    if (cell.alive && (aliveCount < 2 || aliveCount > 3)) {
        return false;
    } else if (!cell.alive && aliveCount == 3) {
        return true;
    } else {
        return cell.alive;
    }
};

// タイマー生成
const clock = new THREE.Clock();
let countClockTime = 0.0;

// 10. アニメーションループ (毎フレーム実行される関数)
const animate = () => {
    requestAnimationFrame(animate);
    // フレームレート表示
    stats.update();
    // 前のフレームからの経過時間（秒）を取得
    const delta = clock.getDelta();
    // タイマー更新
    const borderTime = 0.125;
    countClockTime += delta;
    const aliveMap = {};
    if (countClockTime >= borderTime) {
        // ライフゲーム世代更新
        for (const key in cellsMap) {
            if (cellsMap.hasOwnProperty(key)) {
                let cell = cellsMap[key];
                const alive = updateAliveFlag(cell, cell.alive);
                aliveMap[key] = alive;
            }
        }
        // タイマーリセット
        countClockTime -= borderTime;
    }
    // セル表示の更新
    for (const key in cellsMap) {
        if (cellsMap.hasOwnProperty(key)) {
            let cell = cellsMap[key];
            // 世代反映
            if (aliveMap.hasOwnProperty(key)) {
                cell.alive = aliveMap[key];
            }
            // 物体
            let shape = cell.shape;
            // 色のアニメーション
            shape.userData.currentHue += 0.002;
            updateCellMaterialColor(shape.material, shape.userData.currentHue, cell.alive);
        }
    }
    // 視点操作の更新（Damping有効時）
    controls.update();
    // 描画実行
    renderer.render(threeScene, camera);
};

// アニメーション開始
animate();