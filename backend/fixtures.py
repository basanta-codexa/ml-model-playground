"""Synthetic-but-representative messy datasets, used as demos and in tests.

The easy datasets (iris, wine) hide the problems that make real CSV files
hard. The exports below are the kind you will meet in the wild:

  * Numbers written with units: "963 hp", "2.5 sec", "120 g".
  * Prices written as money: "$1,100,000".
  * Ranges: "3-5 days", "70-85 hp".
  * Two different measurements in one cell: "1,600 cc / 13.8 kwh".
  * Windows dashes: "2-6 seats" with an en dash, not a hyphen.
  * The same label spelled three ways: TOYOTA, Toyota, toyota.
  * A column that leaks the target: a derived copy of the label, spelled
    differently.
  * Hundreds of one-off names.

`build_sales_dataset` is the flagship demo: a retail sales export.
`build_car_dataset` is kept for the test suite and is not exposed as a
sample in the app. The data is generated from fixed seeds.
"""

import random

import numpy as np
import pandas as pd

SEED = 20240607

COMPANIES = [
    "Maruti", "Hyundai", "Tata", "Mahindra", "Toyota", "Honda", "Ford",
    "Chevrolet", "Kia", "Nissan", "Renault", "Skoda", "Volkswagen",
    "Audi", "BMW", "Mercedes-Benz", "Jaguar", "Land Rover", "Datsun",
    "Fiat", "Kawasaki", "Bajaj", "Royal Enfield", "Yamaha", "Hero",
    "TVS", "Suzuki", "Citroen", "Jeep", "Volvo", "Hummer", "Mitsubishi",
    "Nissan", "Tata", "Kia", "Toyota", "Maruti", "Hyundai",
]

# The same brands, written the way different people type them.
SPELLINGS = {
    "Maruti": ["Maruti", "MARUTI", "maruti"],
    "Toyota": ["Toyota", "TOYOTA", "toyota"],
    "Kia": ["Kia", "KIA", "kia"],
    "Nissan": ["Nissan", "NISSAN", "nissan"],
    "Tata": ["Tata", "TATA", "tata"],
    "Hyundai": ["Hyundai", "HYUNDAI", "hyundai"],
}

FUEL_TYPES = [
    "Petrol", "Diesel", "CNG", "Electric", "Hybrid", "Petrol", "Diesel",
    "CNG", "Electric", "Hybrid", "LPG", "CNG",
]

MODELS = {    "Maruti": ["Swift", "Baleno", "Brezza", "Dzire", "Ertiga", "Wagon R"],
    "Hyundai": ["i20", "i10", "Creta", "Venue", "Verna", "Grand i10"],
    "Tata": ["Nexon", "Punch", "Altroz", "Tiago", "Harrier", "Safari"],
    "Mahindra": ["XUV700", "Scorpio", "Thar", "Bolero", "Verito", "KUV100"],
    "Toyota": ["Innova", "Fortuner", "Etios", "Corolla", "Glanza", "Camry"],
    "Honda": ["City", "Amaze", "Jazz", "Elevate", "City", "CR-V"],
    "Ford": ["EcoSport", "Figo", "Aspire", "Endeavour", "Ecosport", "Mustang"],
    "Chevrolet": ["Spark", "Sail", "Ciaz", "Aveo", "Cruze", "Trax"],
    "Kia": ["Seltos", "Sonet", "Carens", "K3", "EV6", "Sportage"],
    "Nissan": ["Magnite", "Kicks", "Terrano", "Sunny", "Micra", "X-Trail"],
    "Renault": ["Kwid", "Triber", "Duster", "City", "Kiger", "Zig"],
    "Skoda": ["Slavia", "Kushaq", "Rapid", "Octavia", "Karoq", "Enyaq"],
    "Volkswagen": ["Polo", "Vento", "GTI", "Vagaron", "Tiguan", "Jetta"],
    "Audi": ["A4", "A6", "Q5", "Q7", "A3", "Eon"],
    "BMW": ["320", "X1", "X3", "X5", "530", "i4"],
    "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLC", "GLA", "A-Class"],
    "Jaguar": ["F-Pace", "E-Pace", "XE", "XF", "XK", "F-Type"],
    "Land Rover": ["Defender", "Discovery", "Range Rover", "Evoque", "Sport"],
    "Datsun": ["Redi-Go", "Go", "Go Plus", "Redi-Go Plus", "G-Wagon"],
    "Fiat": ["Punto", "Fiat", "Urban", "500", "Doblo", "Linea"],
    "Bajaj": ["Chetak", "Pulsar", "Platina", "Qute", "F140", "Discover"],
    "Hero": ["Splendor", "HF Deluxe", "Passion", "Xtreme", "Passion Pro"],
    "Royal Enfield": ["Classic", "Himalayan", "Thunderbolt", "Meteor", "Hunter"],
    "TVS": ["Apache", "Jupiter", "Ntorq", "Raider", "Apache RTR"],
    "Suzuki": ["Baleno", "Brezza", "Wagon R", "Ertiga", "Ciaz", "Vitara"],
    "Citroen": ["C3", "C5 Aircross", "C-Elysee", "Basalt", "Berlingo", "DS3"],
    "Jeep": ["Compass", "Meridian", "Wrangler", "Renegade", "Avenger"],
    "Volvo": ["XC40", "XC60", "XC90", "S60", "V40", "S90"],
    "Hummer": ["H3", "H2", "Hummer EV", "H3T", "H3X", "HM3"],
    "Mitsubishi": ["Lancer", "Outlander", "Pajero", "Eclipse", "Montero"],
}


# A rough market value per brand, so the generated prices are believable.
BRAND_VALUE = {
    "Maruti": 450000, "Hyundai": 550000, "Tata": 600000, "Mahindra": 900000,
    "Toyota": 1100000, "Honda": 800000, "Ford": 700000, "Chevrolet": 600000,
    "Kia": 750000, "Nissan": 700000, "Renault": 450000, "Skoda": 850000,
    "Volkswagen": 900000, "Audi": 1800000, "BMW": 2000000,
    "Mercedes-Benz": 2200000, "Jaguar": 1900000, "Land Rover": 2400000,
    "Datsun": 300000, "Fiat": 400000, "Bajaj": 150000, "Hero": 90000,
    "Royal Enfield": 200000, "TVS": 130000, "Suzuki": 350000,
    "Citroen": 500000, "Jeep": 1200000, "Volvo": 1600000, "Hummer": 2500000,
    "Mitsubishi": 700000,
}


def _car_name(company: str, model: str, index: int) -> str:
    """A name that looks like a real listing: model plus a trim code."""
    trims = ["VXi", "ZXI", "LXi", "EX", "SX", "DX", "AMT", "MT"]
    return f"{company} {model} {trims[index % len(trims)]}"


def build_car_dataset(rows: int = 420) -> pd.DataFrame:
    """Build the messy car dataset. The same every time, for the same seed."""
    rng = random.Random(SEED)

    records = []
    for index in range(rows):
        company = rng.choice(COMPANIES)
        company_text = rng.choice(SPELLINGS.get(company, [company]))
        model = rng.choice(MODELS.get(company, ["Model"]))
        name = _car_name(company, model, index)

        fuel = rng.choice(FUEL_TYPES)
        # "Engine" repeats the fuel type: this is the leaking column.
        engine = "Diesel" if fuel == "Diesel" else "Petrol"

        electric = fuel in ("Electric", "Hybrid")
        if electric:
            displacement = f"{rng.randint(0, 3)} cc / {round(rng.uniform(10, 45), 1)} kwh"
            power_number = rng.randint(40, 150)
            power = f"{power_number} hp"
            torque = f"{rng.randint(100, 400)} Nm"
        else:
            # Engine size is a real clue about the fuel: diesels are bigger.
            if fuel == "Diesel":
                cc = rng.randint(1400, 2500)
            elif fuel in ("CNG", "LPG"):
                cc = rng.randint(1000, 1600)
            else:
                cc = rng.randint(800, 1800)
            displacement = f"{cc:,} cc"
            power_number = rng.randint(45, 250)
            power = f"{power_number} hp"
            torque = f"{rng.randint(80, 600)} Nm"

        # Windows en dash between the two seat counts, not a hyphen.
        low = rng.choice([2, 4, 5, 5, 5, 7])
        high = low + rng.choice([0, 1, 1, 2])
        seats = f"{low}\u2013{high} seats" if high != low else f"{low} seats"

        acceleration = f"{round(rng.uniform(5, 20), 1)} sec"
        mileage = f"{round(rng.uniform(8, 30), 1)} km/l"

        # A real price depends on the car: brand, power and fuel all push it
        # around, with a lot of noise on top. A price that is pure noise
        # would make every model look useless, which is not the point of a
        # demo dataset.
        brand_value = BRAND_VALUE.get(company, 500000)
        power_value = power_number * 9000
        fuel_value = {"Electric": 900000, "Hybrid": 700000, "Diesel": 200000,
                      "CNG": 150000, "LPG": 100000}.get(fuel, 0)
        price = (brand_value + power_value + fuel_value
                 + rng.gauss(0, 250000))
        price = max(120000, round(price / 5000) * 5000)
        price_text = f"${price:,}"

        records.append({
            "Names": name,
            "Company Names": company_text,
            "Fuel Types": fuel,
            "Engine": engine,
            "Engine Displacement": displacement,
            "Max Power": power,
            "Max Torque": torque,
            "Acceleration": acceleration,
            "Seats": seats,
            "Mileage": mileage,
            "Price": price_text,
        })

    frame = pd.DataFrame.from_records(records)

    # A handful of real gaps, and a few cells that say "no value" instead.
    frame.loc[rng.sample(range(len(frame)), 12), "Mileage"] = "N/A"
    frame.loc[rng.sample(range(len(frame)), 7), "Max Torque"] = "-"
    return frame


# --- the flagship demo: a messy retail sales export ---------------------------

SALES_SEED = 20240611

RETAILERS = [
    "Northgate", "Bluepine", "Harrow & Co", "Kestrel Mart", "Alderlane",
    "Copperfield", "Marlow Stores", "Eastvale", "Redbrook", "Anchor & Co",
    "Linden Park", "Bramble Hill", "Fenton Row", "Silver Birch", "Ochre Lane",
]

PRODUCTS = {
    "Northgate": ["Kettle V2", "Press H", "Grinder Pro", "Filter Kit", "Scale S"],
    "Bluepine": ["French Press", "Dripper", "Carafe", "Filters", "Kettle"],
    "Harrow & Co": ["Toaster", "Blender X1", "Juicer", "Coffee Grinder", "Toastie Press"],
    "Kestrel Mart": ["Notebook A5", "Gel Pens", "Desk Lamp", "Planner", "Folder Set"],
    "Alderlane": ["Hiking Socks", "Trail Mix", "Water Bottle", "Headlamp", "Map Case"],
    "Copperfield": ["Tea Tins", "Mugs", "Teapot", "Caddy", "Infuser"],
    "Marlow Stores": ["Backpack Trail", "Rain Jacket", "Bottle Cage", "Cycling Cap", "Patch Kit"],
    "Eastvale": ["Plant Pot", "Soil Bag", "Trowel", "Seed Pack", "Watering Can"],
    "Redbrook": ["Puzzle 1000", "Board Game", "Card Deck", "Trivia Box", "Domino Set"],
    "Anchor & Co": ["Anchor Soap", "Hand Cream", "Lip Balm", "Candle", "Bath Salts"],
    "Linden Park": ["Picnic Basket", "Blanket", "Thermos", "Cutlery Set", "Cool Bag"],
    "Bramble Hill": ["Jam Jar", "Honey Pot", "Bread Board", "Butter Dish", "Tea Towel"],
    "Fenton Row": ["Kettlebell Heavy", "Yoga Mat", "Resistance Band", "Foam Roller", "Jump Rope"],
    "Silver Birch": ["Notepad", "Pen Set", "Pen Stand", "Desk Organiser", "Sticky Notes"],
    "Ochre Lane": ["Scarf", "Beanie", "Gloves", "Earmuffs", "Neck Warmer"],
}

# The sales channel is offered as a classification target; the segment code
# below repeats it in caps, which is the leaking column.
CHANNELS = ["In-store", "Online", "Partner"]
# Spellings people actually type, mixed freely: the fold merges them into
# one label, and "Segment Code" repeats the answer in caps.
CHANNEL_SPELLINGS = {"In-store": ["In-store", "in-store", "IN-STORE"],
                     "Online": ["Online", "online", "ONLINE"],
                     "Partner": ["Partner", "partner", "PARTNER"]}
SEGMENT_LEAK = {"In-store": ["IN-STORE", "in-store"],
                "Online": ["ONLINE", "online"],
                "Partner": ["PARTNER", "partner"]}


def build_sales_dataset(rows: int = 420) -> pd.DataFrame:
    """A messy retail sales export. The same every time, for the same seed."""
    rng = random.Random(SALES_SEED)

    records = []
    for _ in range(rows):
        retailer = rng.choice(RETAILERS)
        product = rng.choice(PRODUCTS[retailer])
        name = f"{retailer} {product}"
        channel_base = rng.choice(CHANNELS)
        channel = rng.choice(CHANNEL_SPELLINGS[channel_base])
        segment_code = rng.choice(SEGMENT_LEAK[channel_base])

        base = {"In-store": 620, "Online": 880, "Partner": 1400}[channel_base]
        order_value = max(40, base + rng.gauss(0, 260))
        order_value = round(order_value / 10) * 10

        # Net contents: some rows carry a mass, some a volume, some both.
        roll = rng.random()
        if roll < 0.55:
            contents = rng.choice(["750 ml", "500 ml", "330 ml", "1 l"])
        elif roll < 0.78:
            contents = rng.choice(["340 g", "250 g", "120 g", "1 kg", "500 g"])
        else:
            contents = rng.choice(["500 ml / 180 g", "750 ml / 310 g", "330 ml / 340 g"])

        items = rng.randint(1, 48)
        if rng.random() < 0.06:
            rating = "N/A"
        else:
            rating = f"{round(rng.uniform(3.2, 5.0), 1)} stars"

        discount = f"{rng.choice([0, 0, 5, 10, 15, 20, 25])}%"
        delivery = f"{rng.randint(2, 9)}-{rng.randint(10, 21)} days"
        region = rng.choice(["North", "NORTH", "north", "South", "SOUTH", "East", "EAST", "West", "WEST"])

        records.append({
            "Order Ref": name,
            "Region": region,
            "Channel": channel,
            "Segment Code": segment_code,
            "Items": items,
            "Unit Price": f"${round(rng.uniform(3, 220), 2)}",
            "Order Value": f"${order_value:,.0f}",
            "Discount": discount,
            "Delivery Window": delivery,
            "Net Contents": contents,
            "Rating": rating,
        })

    frame = pd.DataFrame.from_records(records)
    # A few real gaps, and a few cells that say "no value" instead.
    frame["Items"] = frame["Items"].astype("float64")
    frame.loc[rng.sample(range(len(frame)), 8), "Items"] = np.nan
    frame.loc[rng.sample(range(len(frame)), 6), "Discount"] = "-"
    return frame
