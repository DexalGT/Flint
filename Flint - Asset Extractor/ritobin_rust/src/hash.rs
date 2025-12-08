use std::ops::BitXor;

pub struct Fnv1a(pub u32);

impl Fnv1a {
    pub fn new(s: &str) -> Self {
        let mut h: u32 = 0x811c9dc5;
        for c in s.bytes() {
            let c = if c >= b'A' && c <= b'Z' {
                c - b'A' + b'a'
            } else {
                c
            };
            h = (h.bitxor(c as u32)).wrapping_mul(0x01000193);
        }
        Self(h)
    }
}

pub fn fnv1a(s: &str) -> u32 {
    Fnv1a::new(s).0
}

pub struct Xxh64(pub u64);

impl Xxh64 {
    pub fn new(s: &str) -> Self {
        Self(xxh64(s.as_bytes(), 0))
    }
}

fn xxh64(data: &[u8], seed: u64) -> u64 {
    let len = data.len();
    let end = len;
    let mut ptr = 0;

    const PRIME1: u64 = 11400714785074694791;
    const PRIME2: u64 = 14029467366897019727;
    const PRIME3: u64 = 1609587929392839161;
    const PRIME4: u64 = 9650029242287828579;
    const PRIME5: u64 = 2870177450012600261;

    let to_lower = |c: u8| -> u64 {
        if c >= b'A' && c <= b'Z' {
            (c - b'A' + b'a') as u64
        } else {
            c as u64
        }
    };

    let block = |data: &[u8], idx: usize| -> u64 {
        to_lower(data[idx])
            | (to_lower(data[idx + 1]) << 8)
            | (to_lower(data[idx + 2]) << 16)
            | (to_lower(data[idx + 3]) << 24)
            | (to_lower(data[idx + 4]) << 32)
            | (to_lower(data[idx + 5]) << 40)
            | (to_lower(data[idx + 6]) << 48)
            | (to_lower(data[idx + 7]) << 56)
    };

    let rotl = |x: u64, r: u32| -> u64 { x.rotate_left(r) };

    let mut result: u64;

    if len >= 32 {
        let mut s1 = seed.wrapping_add(PRIME1).wrapping_add(PRIME2);
        let mut s2 = seed.wrapping_add(PRIME2);
        let mut s3 = seed;
        let mut s4 = seed.wrapping_sub(PRIME1);

        while ptr + 32 <= end {
            s1 = rotl(s1.wrapping_add(block(data, ptr).wrapping_mul(PRIME2)), 31).wrapping_mul(PRIME1);
            s2 = rotl(s2.wrapping_add(block(data, ptr + 8).wrapping_mul(PRIME2)), 31).wrapping_mul(PRIME1);
            s3 = rotl(s3.wrapping_add(block(data, ptr + 16).wrapping_mul(PRIME2)), 31).wrapping_mul(PRIME1);
            s4 = rotl(s4.wrapping_add(block(data, ptr + 24).wrapping_mul(PRIME2)), 31).wrapping_mul(PRIME1);
            ptr += 32;
        }

        result = rotl(s1, 1)
            .wrapping_add(rotl(s2, 7))
            .wrapping_add(rotl(s3, 12))
            .wrapping_add(rotl(s4, 18));

        result ^= rotl(s1.wrapping_mul(PRIME2), 31).wrapping_mul(PRIME1);
        result = result.wrapping_mul(PRIME1).wrapping_add(PRIME4);
        result ^= rotl(s2.wrapping_mul(PRIME2), 31).wrapping_mul(PRIME1);
        result = result.wrapping_mul(PRIME1).wrapping_add(PRIME4);
        result ^= rotl(s3.wrapping_mul(PRIME2), 31).wrapping_mul(PRIME1);
        result = result.wrapping_mul(PRIME1).wrapping_add(PRIME4);
        result ^= rotl(s4.wrapping_mul(PRIME2), 31).wrapping_mul(PRIME1);
        result = result.wrapping_mul(PRIME1).wrapping_add(PRIME4);
    } else {
        result = seed.wrapping_add(PRIME5);
    }

    result = result.wrapping_add(len as u64);

    while ptr + 8 <= end {
        let k1 = block(data, ptr).wrapping_mul(PRIME2);
        result ^= rotl(k1, 31).wrapping_mul(PRIME1);
        result = rotl(result, 27).wrapping_mul(PRIME1).wrapping_add(PRIME4);
        ptr += 8;
    }

    if ptr + 4 <= end {
        let k1 = to_lower(data[ptr])
            | (to_lower(data[ptr + 1]) << 8)
            | (to_lower(data[ptr + 2]) << 16)
            | (to_lower(data[ptr + 3]) << 24);
        result ^= k1.wrapping_mul(PRIME1);
        result = rotl(result, 23).wrapping_mul(PRIME2).wrapping_add(PRIME3);
        ptr += 4;
    }

    while ptr < end {
        result ^= to_lower(data[ptr]).wrapping_mul(PRIME5);
        result = rotl(result, 11).wrapping_mul(PRIME1);
        ptr += 1;
    }

    result ^= result >> 33;
    result = result.wrapping_mul(PRIME2);
    result ^= result >> 29;
    result = result.wrapping_mul(PRIME3);
    result ^= result >> 32;

    result
}
