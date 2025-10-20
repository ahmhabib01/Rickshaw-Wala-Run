// গেমের কনফিগারেশন
const config = {
    type: Phaser.AUTO,
    width: 480, // স্ট্যান্ডার্ড মোবাইল পোর্ট্রেট সাইজ
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            // debug: true, // চাইলে Physics বডি দেখতে পারেন
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// গ্লোবাল ভেরিয়েবলস
let rickshawala;
let cursors;
let score = 0;
let scoreText;
let obstacles;
let passengers;
let powerUps;
let isPickingUp = false;
let currentFare = 0;
let distanceText;
let distance = 0;
let isGameOver = false;

function preload ()
{
    // *** আপনার তৈরি PNG ফাইলগুলো এখানে লোড হবে ***
    // আপনাকে 'assets' ফোল্ডারে এই ফাইলগুলো রাখতে হবে।
    this.load.image('rickshawala', 'assets/rickshaw.png');
    this.load.image('road', 'assets/road_tile.png');
    
    // বাধার প্লেসহোল্ডার
    this.load.image('vip_car', 'assets/vip_car.png');
    this.load.image('bus', 'assets/bus.png');
    this.load.image('bike', 'assets/bike.png'); 
    this.load.image('goat', 'assets/goat.png'); // ছাগল
    
    // যাত্রী ও পাওয়ার-আপ
    this.load.image('passenger', 'assets/passenger.png');
    this.load.image('tea', 'assets/tea.png');
}

function create ()
{
    // ভেরিয়েবল রিসেট
    score = 0;
    distance = 0;
    isPickingUp = false;
    isGameOver = false;
    currentFare = 0;

    // ১. রাস্তা সেটআপ (Endless Scrolling Background)
    this.road = this.add.tileSprite(config.width / 2, config.height / 2, config.width, config.height, 'road');
    
    // ২. রিকশাওয়ালা সেটআপ
    rickshawala = this.physics.add.sprite(config.width / 2, config.height - 100, 'rickshawala');
    rickshawala.setScale(0.7); 
    rickshawala.setCollideWorldBounds(true); 
    rickshawala.setData('invulnerable', false); // পাওয়ার-আপ স্টেট
    rickshawala.setDepth(1); // রিকশাকে সবার উপরে রাখা

    // ৩. কীবোর্ড ইনপুট সেটআপ
    cursors = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    
    // ৪. UI সেটআপ
    scoreText = this.add.text(10, 10, 'ভাড়া: 0 টাকা', { fontSize: '24px', fill: '#FFD700', backgroundColor: '#000000' }).setDepth(2);
    distanceText = this.add.text(10, 40, 'দূরত্ব: 0 KM', { fontSize: '18px', fill: '#FFFFFF', backgroundColor: '#000000' }).setDepth(2);
    
    // ৫. অবজেক্ট গ্রুপ তৈরি
    obstacles = this.physics.add.group();
    passengers = this.physics.add.group();
    powerUps = this.physics.add.group();
    
    // ৬. অবজেক্ট স্পনিং এর জন্য টাইমার
    this.time.addEvent({
        delay: 1200, // প্রতি 1.2 সেকেন্ড পর পর অবজেক্ট তৈরি
        callback: spawnObject,
        callbackScope: this,
        loop: true
    });
    
    // ৭. কোলিশন সেটআপ
    this.physics.add.collider(rickshawala, obstacles, hitObstacle, null, this);
    this.physics.add.overlap(rickshawala, passengers, pickUpPassenger, null, this);
    this.physics.add.overlap(rickshawala, powerUps, collectPowerUp, null, this);
}

// নতুন অবজেক্ট তৈরি
function spawnObject() {
    if (isGameOver) return;
    
    const x = Phaser.Math.Between(50, config.width - 50);
    const y = -50;
    let object;
    
    // চান্স বিভাজন: 10% PowerUp, 20% Passenger, 70% Obstacle
    if (Math.random() < 0.10) { 
        // পাওয়ার-আপ (ঝটপট চা)
        object = powerUps.create(x, y, 'tea');
        object.setScale(0.5);
    }
    else if (Math.random() < 0.30 && !isPickingUp) { // 20% চান্স (0.10-0.30)
        // যাত্রী তৈরি
        object = passengers.create(x, y, 'passenger');
        currentFare = Phaser.Math.Between(50, 150);
        object.setScale(0.6);
    } 
    else { // 70% চান্স
        // বাধা তৈরি (VIP কার, বাস, বাইক, ছাগল)
        const obstacleType = Phaser.Math.RND.pick(['vip_car', 'bus', 'bike', 'goat']);
        object = obstacles.create(x, y, obstacleType);
        object.setScale(0.6);
        // ছাগলকে একটু দ্রুত চালানো
        if (obstacleType === 'goat') object.setVelocityY(250); 
    }
    
    object.setVelocityY(200); 
    
    // স্ক্রিনের বাইরে গেলে ধ্বংস
    this.time.delayedCall(4000, () => {
        if (object.active) object.destroy();
    });
}

// রিকশাওয়ালা পাওয়ার-আপ নিলে
function collectPowerUp(player, powerUp) {
    powerUp.disableBody(true, true);
    
    const ui = this.add.text(config.width / 2, 50, 'ঝটপট চা! রিকশা এখন রকেট!', { 
        fontSize: '20px', fill: '#FFFF00', backgroundColor: '#000000'
    }).setOrigin(0.5).setDepth(2);

    // পাওয়ার-আপের প্রভাব: Invulnerable
    player.setData('invulnerable', true);
    player.setAlpha(0.5); 
    
    // ৩ সেকেন্ড পর প্রভাব শেষ
    this.time.delayedCall(3000, () => {
        player.setData('invulnerable', false);
        player.setAlpha(1);
        ui.destroy(); // মেসেজ সরিয়ে ফেলা
    }, [], this);
}


// রিকশাওয়ালা যাত্রী তুললে
function pickUpPassenger(player, passenger) {
    if (!isPickingUp && !isGameOver) {
        isPickingUp = true;
        
        passenger.disableBody(true, true);
        player.setVelocity(0); 
        
        const ui = this.add.text(config.width / 2, config.height / 2 - 50, 
            `যাত্রী উঠাইছেন! ভাড়া: ${currentFare} টাকা`, { 
            fontSize: '24px', fill: '#00FF00', backgroundColor: '#000000'
        }).setOrigin(0.5).setDepth(2);

        // ৩ সেকেন্ড পর গন্তব্যে পৌঁছানো ও টাকা নেওয়া
        this.time.delayedCall(3000, () => {
            isPickingUp = false;
            score += currentFare;
            scoreText.setText('ভাড়া: ' + score + ' টাকা');
            currentFare = 0;
            ui.destroy(); 
        }, [], this);
    }
}


// রিকশাওয়ালা বাধার সাথে ধাক্কা খেলে
function hitObstacle(player, obstacle) {
    if (player.getData('invulnerable')) {
        obstacle.disableBody(true, true); 
        return;
    }
    
    isGameOver = true;
    this.physics.pause();
    player.setTint(0xff0000); 
    
    // গেম ওভার মেসেজ
    this.add.text(config.width / 2, config.height / 2, 
        'গেম ওভার!\nবাস ধাক্কা খাইছে!\n\n(R চাপুন)\nআবার শুরু করতে', { 
        fontSize: '40px', 
        fill: '#FFFFFF',
        backgroundColor: '#FF0000',
        align: 'center'
    }).setOrigin(0.5).setDepth(2);
}

function update ()
{
    if (isGameOver) {
        // গেম ওভার হলে 'R' কি চাপলে রিস্টার্ট হবে
        if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
            this.scene.restart();
        }
        return;
    }

    // ১. রাস্তা সচল রাখা
    this.road.tilePositionY -= 5; 
    
    // ২. দূরত্ব গণনা (রাস্তার গতির উপর ভিত্তি করে)
    distance += 0.005; // প্রতি ফ্রেমে দূরত্ব বাড়ানো
    distanceText.setText('দূরত্ব: ' + Math.floor(distance) + ' KM'); 
    
    // ৩. রিকশাওয়ালা মুভমেন্ট
    rickshawala.setVelocity(0);

    if (!isPickingUp) {
        if (cursors.left.isDown)
        {
            rickshawala.setVelocityX(-200);
        }
        else if (cursors.right.isDown)
        {
            rickshawala.setVelocityX(200);
        }
    }
}
