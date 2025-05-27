-- إنشاء جدول Categories
CREATE TABLE Categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL
);

-- إنشاء جدول Users
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    phone_number VARCHAR(20),
    address TEXT,
    national_id VARCHAR(20) UNIQUE,
    identity_image VARCHAR(255),
    wallet_balance DECIMAL(10, 2) DEFAULT 0.0,
    pending_balance DECIMAL(10, 2) DEFAULT 0.0,
    is_seller BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول Admins
CREATE TABLE Admins (
    admin_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

-- إنشاء جدول Devices
CREATE TABLE Devices (
    device_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id INT,
    starting_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    seller_id INT,
    condition VARCHAR(50),
    manufacturing_year INT,
    accessories TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'sold')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_auction BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (category_id) REFERENCES Categories(category_id),
    FOREIGN KEY (seller_id) REFERENCES Users(user_id)
);

--store device images
CREATE TABLE DeviceImages (
    image_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES Devices(device_id) ON DELETE CASCADE
);


--ad_entity_type (auction, device)
CREATE TABLE SponsoredAds (
    ad_id SERIAL PRIMARY KEY,
    ad_entity_type VARCHAR(20) NOT NULL,
    ad_entity_id INT NOT NULL,
    user_id INT NOT NULL,
    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- إنشاء جدول Orders
CREATE TABLE Orders (
    order_id SERIAL PRIMARY KEY,
    buyer_id INT,
    seller_id INT,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id) REFERENCES Users(user_id),
    FOREIGN KEY (seller_id) REFERENCES Users(user_id)
);

-- إنشاء جدول OrderItems
CREATE TABLE OrderItems (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT,
    device_id INT,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    seller_id INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id),
    FOREIGN KEY (device_id) REFERENCES Devices(device_id),
    FOREIGN KEY (seller_id) REFERENCES Users(user_id)
);

CREATE TABLE Cart (
    cart_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    device_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES Devices(device_id) ON DELETE CASCADE
);

-- إنشاء جدول Payments
CREATE TABLE OrderPayments (
    payment_id SERIAL PRIMARY KEY,
    order_id INT,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    user_id INT NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_id VARCHAR(100),
    FOREIGN KEY (order_id) REFERENCES Orders(order_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
);

CREATE TABLE AdPayments (
    payment_id SERIAL PRIMARY KEY,
    ad_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ad_id) REFERENCES SponsoredAds(ad_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE wallet_history (
    history_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw', 'purchase', 'sale', 'pending')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- إنشاء جدول Shipping
CREATE TABLE Shipping (
    shipping_id SERIAL PRIMARY KEY,
    order_id INT,
    shipping_address TEXT NOT NULL,
    shipping_company VARCHAR(100),
    tracking_number VARCHAR(100),
    shipped_at TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id)
);

-- إنشاء جدول Reviews
CREATE TABLE Reviews (
    review_id SERIAL PRIMARY KEY,
    device_id INT,
    user_id INT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES Devices(device_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE seller_reviews (
    review_id SERIAL PRIMARY KEY,
    seller_id INT,
    user_id INT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES Users(user_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- إنشاء جدول Chats
CREATE TABLE Chats (
    chat_id SERIAL PRIMARY KEY,
    user_id_1 INT,
    user_id_2 INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id_1) REFERENCES Users(user_id),
    FOREIGN KEY (user_id_2) REFERENCES Users(user_id)
);

-- إنشاء جدول Messages
CREATE TABLE Messages (
    message_id SERIAL PRIMARY KEY,
    chat_id INT,
    sender_id INT,
    message_text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES Chats(chat_id),
    FOREIGN KEY (sender_id) REFERENCES Users(user_id)
);


CREATE TABLE Bids (
    bid_id SERIAL PRIMARY KEY,
    device_id INT,
    user_id INT,
    auction_end_time TIMESTAMP,
    bid_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (bid_status IN ('pending','active','cancled', 'ended')),
    minimum_increment DECIMAL(10, 1),
    minimumNonCancellablePrice INT,
    winning_bid_id INT,
    FOREIGN KEY (device_id) REFERENCES Devices(device_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (winning_bid_id) REFERENCES Users(user_id)
);

-- إنشاء جدول BidHistory
CREATE TABLE BidHistory (
    history_id SERIAL PRIMARY KEY,
    bid_id INT,
    user_id INT,
    bid_amount DECIMAL(10, 2) NOT NULL,
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bid_id) REFERENCES Bids(bid_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);


--reported_entity_type (message, device, auction, user)
-- status (pending, reviewed, resolved, rejected)
CREATE TABLE Reports (
    report_id SERIAL PRIMARY KEY,
    reporter_id INT NOT NULL,
    reported_entity_type VARCHAR(20) NOT NULL,
    reported_entity_id INT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES Users(user_id) ON DELETE SET NULL
);


// إنشاء جدول SiteWallet محفظة الموقع لاستقبال فلوس الاعلانات وفلوس الشحن من المنتجات
CREATE TABLE SiteWallet (
    transaction_id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'wallet')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);