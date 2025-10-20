// গেমের কনফিগারেশন
const config = {
    type: Phaser.AUTO,
    width: 800, // আইসোমেট্রিক ভিউয়ের জন্য চওড়া স্ক্রিন
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
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

// --- গ্লোবাল স্টেট ভেরিয়েবলস ---
let rickshawala;
let cursors;
let score = 0; // মোট স্কোর
let scoreText, moneyText, missionText;
let obstacles, passengers, missionTarget;
let isGameOver = false;
let isPickingUp = false;
let isPenaltyActive = false;
let currentLane = 0; // -1: বাম, 0: মাঝ, 1: ডান

// ক্যারিয়ার/ম্যানেজমেন্ট ভেরিয়েবলস
let playerMoney = 100; // শুরু করার জন্য কিছু টাকা
let currentFare = 0; // বর্তমান ভাড়ার পরিমাণ
let RICKSHAW_SPEED = 250; 
const OBSTACLE_SPEED = 200;

// আপগ্রেড স্টেট (গেম রিস্টার্ট হলেও এটি রিসেট হবে না, তবে এই কোডে তা গ্লোবালি সেট করা হয়েছে)
let upgradeLevel = {
    wheel: 0, // গতি
    horn: 0, // পুলিশ এড়ানো
    suspension: 0 // গর্তের প্রভাব
};

const LANE_WIDTH = 100; // প্রতিটি লেনের চওড়া (স্ক্রিন স্পেসে)

// --- ইউটিলিটি ফাংশন ---
function calculateRoadPosition(lane) {
    const center = config.width / 2;
    // -1 (বাম), 0 (মাঝ), 1 (ডান) লেনের X পজিশন
    return center + (lane * LANE_WIDTH); 
}

function preload ()
{
    // *** আইসোমেট্রিক অ্যাসেট লোডিং: এই অ্যাসেটগুলো আপনাকে 'assets' ফোল্ডারে রাখতে হবে। ***
    this.load.image('iso_road', 'assets/iso_road_tile.png'); 
    this.load.image('iso_rickshaw', 'assets/iso_rickshaw.png');
    this.load.image('iso_car', 'assets/iso_car.png'); // সাধারণ ট্র্যাফিক
    this.load.image('iso_passenger', 'assets/iso_passenger.png'); // যাত্রী
    this.load.image('iso_target', 'assets/iso_target_sign.png'); // ড্রপ-অফ পয়েন্ট
    this.load.image('iso_police', 'assets/iso_police_asset.png'); // পুলিশ
    this.load.image('iso_pothole', 'assets/iso_pothole.png'); // গর্ত
}

function create ()
{
    // --- গ্যারেজ শপ মেনু লজিক ---
    // গেমের প্রথমবার লোডিং-এ শপ দেখানো
    if (!this.scene.settings.data.isGameStarted) {
        showGarageShop.call(this);
        return; 
    }
    
    // --- গেমপ্লে ইনিশিয়ালাইজেশন ---
    score = 0;
    isGameOver = false;
    currentLane = 0;
    
    // আপগ্রেড অনুযায়ী গতির বেস সেট করা
    RICKSHAW_SPEED = 250 + (upgradeLevel.wheel * 50); 

    // ১. আইসোমেট্রিক রোড ব্যাকগ্রাউন্ড
    this.road = this.add.tileSprite(config.width / 2, config.height / 2, config.width, config.height, 'iso_road');
    
    // ২. রিকশাওয়ালা সেটআপ
    const startX = calculateRoadPosition(currentLane);
    rickshawala = this.physics.add.sprite(startX, config.height - 100, 'iso_rickshaw');
    rickshawala.setScale(0.8); 
    rickshawala.setCollideWorldBounds(true); 
    rickshawala.setData('invulnerable', false); // পাওয়ার-আপ স্টেট
    rickshawala.setDepth(1); 

    // ৩. কীবোর্ড ইনপুট সেটআপ
    cursors = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    
    // লেন পরিবর্তনের জন্য কীবোর্ড ইভেন্ট
    cursors.left.on('down', () => changeLane.call(this, -1));
    cursors.right.on('down', () => changeLane.call(this, 1));
    
    // ৪. UI সেটআপ
    scoreText = this.add.text(10, 10, 'ভাড়া: 0 টাকা', { fontSize: '24px', fill: '#FFD700', backgroundColor: '#000000' }).setDepth(2);
    moneyText = this.add.text(10, 40, 'টাকা: ' + playerMoney + ' ৳', { fontSize: '20px', fill: '#00FF00', backgroundColor: '#000000' }).setDepth(2);
    missionText = this.add.text(config.width / 2, 10, 'মিশন: কোনো যাত্রী নেই', { fontSize: '20px', fill: '#FFFFFF', backgroundColor: '#000000' }).setOrigin(0.5).setDepth(2);

    // ৫. অবজেক্ট গ্রুপ তৈরি
    obstacles = this.physics.add.group();
    passengers = this.physics.add.group();
    missionTarget = this.physics.add.group();
    
    // ৬. অবজেক্ট স্পনিং এর জন্য টাইমার
    this.time.addEvent({
        delay: 1000, 
        callback: spawnObstacle,
        callbackScope: this,
        loop: true
    });
    
    // যাত্রী খোঁজার জন্য আলাদা টাইমার (মিশনভিত্তিক)
    this.time.addEvent({
        delay: 5000, 
        callback: spawnPassenger,
        callbackScope: this,
        loop: true
    });

    // ৭. কোলিশন সেটআপ
    this.physics.add.collider(rickshawala, obstacles, hitObstacle, null, this);
    this.physics.add.overlap(rickshawala, passengers, pickUpPassenger, null, this);
    this.physics.add.overlap(rickshawala, missionTarget, dropOffPassenger, null, this); 
}

// --- গেমপ্লে লজিক ফাংশনস ---

function changeLane(direction) {
    if (isGameOver || isPickingUp || isPenaltyActive) return;
    
    const newLane = Phaser.Math.Clamp(currentLane + direction, -1, 1);
    
    if (newLane !== currentLane) {
        currentLane = newLane;
        const targetX = calculateRoadPosition(currentLane);
        
        this.tweens.add({
            targets: rickshawala,
            x: targetX,
            duration: 150, 
            ease: 'Sine.easeOut'
        });
    }
}

function spawnObstacle() {
    if (isGameOver) return;
    
    const lane = Phaser.Math.RND.pick([-1, 0, 1]);
    const x = calculateRoadPosition(lane);
    const y = -50; 
    
    let obstacleType;
    
    // চান্স বিভাজন: 8% পুলিশ, 8% গর্ত, বাকি সাধারণ ট্র্যাফিক
    if (Math.random() < 0.08) { 
        obstacleType = 'iso_police';
    } else if (Math.random() < 0.16) { 
        obstacleType = 'iso_pothole';
    } else {
        obstacleType = Phaser.Math.RND.pick(['iso_car', 'iso_car']); 
    }
    
    let object = obstacles.create(x, y, obstacleType);
    object.setScale(0.7); 
    object.setVelocityY(OBSTACLE_SPEED); 
    object.setData('type', obstacleType);
    
    this.time.delayedCall(4000, () => {
        if (object.active) object.destroy();
    });
}

function spawnPassenger() {
    if (isGameOver || isMissionActive || isPenaltyActive) return;
    
    const lane = Phaser.Math.RND.pick([-1, 0, 1]);
    const x = calculateRoadPosition(lane);
    const y = -50; 
    
    let object = passengers.create(x, y, 'iso_passenger');
    object.setScale(0.6); 
    object.setVelocityY(OBSTACLE_SPEED); 
    
    object.setData('fare', Phaser.Math.Between(50, 200));
    
    this.time.delayedCall(4000, () => {
        if (object.active) object.destroy();
    });
    
    missionText.setText('মিশন: যাত্রী খুঁজুন!');
}

// --- মিশন হ্যান্ডলিং ফাংশনস ---

function pickUpPassenger(player, passenger) {
    if (!isMissionActive && !isPenaltyActive) {
        isPickingUp = true;
        
        passenger.disableBody(true, true);
        this.physics.pause();
        
        const fare = passenger.getData('fare');
        currentFare = fare;
        
        missionText.setText(`মিশন: যাত্রী তুলেছে! ভাড়া: ${fare} ৳`);

        this.time.delayedCall(1500, () => {
            this.physics.resume();
            isPickingUp = false;
            
            const targetLane = Phaser.Math.RND.pick([-1, 0, 1]);
            const targetX = calculateRoadPosition(targetLane);
            const targetY = -config.height * 2; 
            
            missionTarget.create(targetX, targetY, 'iso_target')
                .setScale(0.8)
                .setVelocityY(RICKSHAW_SPEED) 
                .setData('fare', fare);
                
            missionText.setText('মিশন: গন্তব্যে পৌঁছান! (' + fare + ' ৳)');
            
        }, [], this);
    }
}

function dropOffPassenger(player, target) {
    if (isMissionActive && !isPenaltyActive) {
        isMissionActive = false;
        
        target.disableBody(true, true);
        
        playerMoney += currentFare;
        moneyText.setText('টাকা: ' + playerMoney + ' ৳');
        
        score += currentFare;
        scoreText.setText('ভাড়া: ' + score + ' টাকা');
        currentFare = 0;

        this.physics.pause();
        missionText.setText('মিশন সম্পন্ন! পরবর্তী যাত্রীর জন্য প্রস্তুত হন।');
        
        this.time.delayedCall(2000, () => {
            this.physics.resume();
            missionText.setText('মিশন: কোনো যাত্রী নেই');
        }, [], this);
    }
}

// --- বাধা হ্যান্ডলিং ফাংশনস ---

function hitObstacle(player, obstacle) {
    const obstacleType = obstacle.getData('type');
    
    if (obstacleType === 'iso_police') {
        handlePoliceEncounter.call(this, player, obstacle);
        return;
    } 
    
    if (obstacleType === 'iso_pothole') {
        handlePotholeHit.call(this, player, obstacle);
        return;
    }
    
    // সাধারণ ট্র্যাফিকের সাথে ধাক্কা (গেম ওভার)
    isGameOver = true;
    this.physics.pause();
    player.setTint(0xff0000); 
    
    this.add.text(config.width / 2, config.height / 2, 
        'গেম ওভার! বাসের সাথে ধাক্কা!\n(R চাপুন)', { 
        fontSize: '40px', fill: '#FFFFFF', backgroundColor: '#FF0000', align: 'center'
    }).setOrigin(0.5).setDepth(2);
}

function handlePoliceEncounter(player, police) {
    if (isPenaltyActive) return;

    isPenaltyActive = true;
    police.disableBody(true, true); 
    this.physics.pause(); 
    
    // হর্ন আপগ্রেড: পুলিশকে এড়ানোর চান্স
    const avoidChance = upgradeLevel.horn * 20; 
    
    if (Phaser.Math.RND.between(1, 100) <= avoidChance) {
        this.add.text(config.width / 2, config.height / 2, 
            'জাদু হর্ন! পুলিশ মামা দেখতেই পায়নি!', { 
            fontSize: '30px', fill: '#00FFFF', backgroundColor: '#000000', align: 'center'
        }).setOrigin(0.5).setDepth(3);

        this.time.delayedCall(1500, () => {
            this.physics.resume();
            isPenaltyActive = false;
        }, [], this);
        return; 
    }
    
    // জরিমানা লজিক
    const penaltyAmount = Phaser.Math.Between(30, 80);
    
    if (playerMoney >= penaltyAmount) {
        playerMoney -= penaltyAmount;
        moneyText.setText('টাকা: ' + playerMoney + ' ৳');

        this.add.text(config.width / 2, config.height / 2, 
            `পুলিশে ধরছে! ${penaltyAmount} ৳ জরিমানা!`, { 
            fontSize: '30px', fill: '#FF0000', backgroundColor: '#000000', align: 'center'
        }).setOrigin(0.5).setDepth(3);

    } else {
        this.add.text(config.width / 2, config.height / 2, 
            `জরিমানা দেওয়ার টাকা নাই!\nরিকশা বাজেয়াপ্ত!`, { 
            fontSize: '30px', fill: '#FF0000', backgroundColor: '#000000', align: 'center'
        }).setOrigin(0.5).setDepth(3);
        
        isGameOver = true; 
    }
    
    this.time.delayedCall(2000, () => {
        if (!isGameOver) {
            this.physics.resume();
            isPenaltyActive = false;
        }
    }, [], this);
}

function handlePotholeHit(player, pothole) {
    pothole.disableBody(true, true); 
    
    let slowDuration = 1000; 
    
    // সাসপেনশন আপগ্রেড: প্রতি লেভেলে স্লো টাইম 200ms করে কমবে
    if (upgradeLevel.suspension > 0) {
        slowDuration -= (upgradeLevel.suspension * 200);
        if (slowDuration < 200) slowDuration = 200; 
    }
    
    player.setVelocityY(-RICKSHAW_SPEED / 2); // রিকশাকে সামান্য পিছনে ধাক্কা দেওয়া
    
    this.add.text(config.width / 2, 50, 'উফ! বড় গর্ত!', { 
        fontSize: '20px', fill: '#FFA500', backgroundColor: '#000000'
    }).setOrigin(0.5).setDepth(3);

    this.time.delayedCall(slowDuration, () => {
        player.setVelocityY(0); 
    }, [], this);
}

// --- গ্যারেজ শপ লজিক (মেনু) ---
function showGarageShop() {
    this.physics.pause();
    
    const overlay = this.add.rectangle(0, 0, config.width, config.height, 0x000000, 0.8).setOrigin(0).setDepth(10);
    
    this.add.text(config.width / 2, 50, 'কালু মামার গ্যারেজ (আপগ্রেড শপ)', { 
        fontSize: '36px', fill: '#FFD700', align: 'center'
    }).setOrigin(0.5).setDepth(11);
    
    const shopMoneyText = this.add.text(config.width / 2, 110, `আপনার টাকা: ${playerMoney} ৳`, { 
        fontSize: '28px', fill: '#00FF00', align: 'center'
    }).setOrigin(0.5).setDepth(11);

    let currentY = 180;
    
    const upgrades = [
        { key: 'wheel', name: 'চাকা (গতি)', cost: 150, description: 'রিকশার বেস গতি বাড়ায়' },
        { key: 'suspension', name: 'সাসপেনশন (গর্তের প্রভাব)', cost: 100, description: 'গর্তে পড়লে ধাক্কা কম খাবে' },
        { key: 'horn', name: 'জাদু হর্ন (বাধা এড়ানো)', cost: 200, description: 'পুলিশের ফাইন এড়ানোর চান্স দেয়' }
    ];

    upgrades.forEach(item => {
        const currentLvl = upgradeLevel[item.key];
        const nextCost = item.cost * (currentLvl + 1);
        
        const upgradeText = this.add.text(config.width / 2, currentY, 
            `${item.name} | লেভেল: ${currentLvl}\n` +
            `${item.description} | খরচ: ${nextCost} ৳`, 
            { fontSize: '20px', fill: '#FFFFFF', backgroundColor: '#333333' }
        ).setOrigin(0.5).setDepth(11).setInteractive();

        // এইবার handleUpgrade ফাংশনকে এখানে কল করা হবে
        upgradeText.on('pointerdown', () => {
            handleUpgrade.call(this, item.key, nextCost, shopMoneyText);
        });
        
        currentY += 80;
    });

    this.add.text(config.width / 2, config.height - 80, 'খেলা শুরু করুন (ENTER)', { 
        fontSize: '36px', fill: '#00FFFF', backgroundColor: '#5D00FF', padding: 10
    }).setOrigin(0.5).setDepth(11);
    
    this.input.keyboard.on('keydown-ENTER', () => {
        // নতুন প্যারামিটার সহ গেমপ্লে শুরু
        this.scene.start('default', { isGameStarted: true });
    });
}

function handleUpgrade(key, cost, moneyTextRef) {
    if (playerMoney >= cost) {
        playerMoney -= cost;
        upgradeLevel[key]++;
        
        moneyTextRef.setText(`আপনার টাকা: ${playerMoney} ৳`);
        
        // সাফল্যের বার্তা
        const successMessage = this.add.text(config.width / 2, config.height / 2, 
            `আপগ্রেড সফল!`, 
            { fontSize: '40px', fill: '#00FF00', backgroundColor: '#000000', padding: 10 }
        ).setOrigin(0.5).setDepth(12);

        // ২ সেকেন্ড পর শপ রিলোড
        this.time.delayedCall(2000, () => {
            successMessage.destroy();
            // বর্তমান Scene বন্ধ করে শপকে আবার শুরু করা
            this.scene.start('default', { isGameStarted: false }); 
        });
    } else {
        // টাকা না থাকার বার্তা
        const failMessage = this.add.text(config.width / 2, config.height / 2, 
            'টাকা কম আছে! আরো ভাড়া মারুন!', 
            { fontSize: '40px', fill: '#FF0000', backgroundColor: '#000000', padding: 10 }
        ).setOrigin(0.5).setDepth(12);
        
        this.time.delayedCall(1500, () => failMessage.destroy());
    }
}


function update ()
{
    if (isGameOver) {
        // গেম ওভার হলে 'R' কি চাপলে গ্যারেজ/মেনুতে যাবে
        if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
            this.scene.start('default', { isGameStarted: false });
        }
        return;
    }

    // ১. আইসোমেট্রিক রোডের স্ক্রলিং
    this.road.tilePositionY -= 7; 
    
    // ২. মিশন টার্গেট ম্যানেজমেন্ট (স্ক্রলিং)
    if (isMissionActive) {
        missionTarget.getChildren().forEach(target => {
            target.y += 7; 
        });
    }

    // রিকশা মুভমেন্ট এখন Tween দ্বারা নিয়ন্ত্রিত (changeLane ফাংশন দেখুন)
}
