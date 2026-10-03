#![no_std]

//! Nkwado: earmarked care payments.
//!
//! A sender locks USDC for one named service at one verified clinic. The
//! patient carries a one-time code (as a QR). Only that clinic, holding that
//! code, can release the funds before the expiry. After the expiry, anyone can
//! return the funds to the sender. No medical data is stored: only a short
//! service code and the hash of the patient's redeem code.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Bytes, BytesN, Env, String, Symbol,
};

const DAY: u32 = 17_280; // ledgers, ~5s each
const TTL_THRESHOLD: u32 = 30 * DAY;
const TTL_EXTEND: u32 = 120 * DAY;
const MAX_WINDOW_SECS: u64 = 90 * 24 * 60 * 60;
const MIN_WINDOW_SECS: u64 = 60;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ClinicNotVerified = 3,
    InvalidAmount = 4,
    InvalidExpiry = 5,
    PledgeNotFound = 6,
    NotOpen = 7,
    WrongClinic = 8,
    Expired = 9,
    BadCode = 10,
    NotExpired = 11,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    Open,
    Redeemed,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Clinic {
    pub name: String,
    pub city: String,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Pledge {
    pub id: u64,
    pub sender: Address,
    pub clinic: Address,
    pub service: Symbol,
    pub amount: i128,
    pub created_at: u64,
    pub expires_at: u64,
    pub code_hash: BytesN<32>,
    pub status: Status,
    pub closed_at: u64,
}

#[contracttype]
enum Key {
    Admin,
    Token,
    NextId,
    Clinic(Address),
    Pledge(u64),
}

#[contractevent(topics = ["pledged"])]
pub struct Pledged {
    #[topic]
    pub id: u64,
    #[topic]
    pub clinic: Address,
    pub sender: Address,
    pub service: Symbol,
    pub amount: i128,
    pub expires_at: u64,
}

#[contractevent(topics = ["redeemed"])]
pub struct Redeemed {
    #[topic]
    pub id: u64,
    #[topic]
    pub clinic: Address,
    pub amount: i128,
}

#[contractevent(topics = ["refunded"])]
pub struct Refunded {
    #[topic]
    pub id: u64,
    pub sender: Address,
    pub amount: i128,
}

#[contractevent(topics = ["clinic"])]
pub struct ClinicSet {
    #[topic]
    pub clinic: Address,
    pub active: bool,
}

#[contract]
pub struct Nkwado;

fn admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&Key::Admin)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn token(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&Key::Token)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
}

fn load_pledge(env: &Env, id: u64) -> Pledge {
    let key = Key::Pledge(id);
    let p: Pledge = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, Error::PledgeNotFound));
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
    p
}

fn save_pledge(env: &Env, p: &Pledge) {
    let key = Key::Pledge(p.id);
    env.storage().persistent().set(&key, p);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
}

#[contractimpl]
impl Nkwado {
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&Key::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::Token, &token);
        env.storage().instance().set(&Key::NextId, &1u64);
    }

    /// Admin verifies (or deactivates) a clinic. Only active clinics can
    /// receive new pledges; existing pledges stay redeemable by their clinic.
    pub fn set_clinic(env: Env, clinic: Address, name: String, city: String, active: bool) {
        admin(&env).require_auth();
        let key = Key::Clinic(clinic.clone());
        env.storage()
            .persistent()
            .set(&key, &Clinic { name, city, active });
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
        bump_instance(&env);
        ClinicSet { clinic, active }.publish(&env);
    }

    /// Lock `amount` of the pledge token for `service` at `clinic` until
    /// `expires_at` (unix seconds). Returns the pledge id.
    pub fn pledge(
        env: Env,
        sender: Address,
        clinic: Address,
        service: Symbol,
        amount: i128,
        expires_at: u64,
        code_hash: BytesN<32>,
    ) -> u64 {
        sender.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let now = env.ledger().timestamp();
        if expires_at < now + MIN_WINDOW_SECS || expires_at > now + MAX_WINDOW_SECS {
            panic_with_error!(&env, Error::InvalidExpiry);
        }
        let verified: Option<Clinic> = env
            .storage()
            .persistent()
            .get(&Key::Clinic(clinic.clone()));
        match verified {
            Some(c) if c.active => {}
            _ => panic_with_error!(&env, Error::ClinicNotVerified),
        }

        token::Client::new(&env, &token(&env)).transfer(
            &sender,
            &env.current_contract_address(),
            &amount,
        );

        let id: u64 = env.storage().instance().get(&Key::NextId).unwrap_or(1);
        env.storage().instance().set(&Key::NextId, &(id + 1));
        bump_instance(&env);

        save_pledge(
            &env,
            &Pledge {
                id,
                sender: sender.clone(),
                clinic: clinic.clone(),
                service: service.clone(),
                amount,
                created_at: now,
                expires_at,
                code_hash,
                status: Status::Open,
                closed_at: 0,
            },
        );
        Pledged {
            id,
            clinic,
            sender,
            service,
            amount,
            expires_at,
        }
        .publish(&env);
        id
    }

    /// The named clinic presents the patient's code to release the funds.
    pub fn redeem(env: Env, clinic: Address, id: u64, code: Bytes) {
        clinic.require_auth();
        let mut p = load_pledge(&env, id);
        if p.status != Status::Open {
            panic_with_error!(&env, Error::NotOpen);
        }
        if p.clinic != clinic {
            panic_with_error!(&env, Error::WrongClinic);
        }
        let now = env.ledger().timestamp();
        if now >= p.expires_at {
            panic_with_error!(&env, Error::Expired);
        }
        let hash: BytesN<32> = env.crypto().sha256(&code).into();
        if hash != p.code_hash {
            panic_with_error!(&env, Error::BadCode);
        }

        p.status = Status::Redeemed;
        p.closed_at = now;
        save_pledge(&env, &p);
        token::Client::new(&env, &token(&env)).transfer(
            &env.current_contract_address(),
            &clinic,
            &p.amount,
        );
        Redeemed {
            id,
            clinic,
            amount: p.amount,
        }
        .publish(&env);
    }

    /// After expiry, anyone may return an unredeemed pledge to its sender.
    pub fn refund(env: Env, id: u64) {
        let mut p = load_pledge(&env, id);
        if p.status != Status::Open {
            panic_with_error!(&env, Error::NotOpen);
        }
        let now = env.ledger().timestamp();
        if now < p.expires_at {
            panic_with_error!(&env, Error::NotExpired);
        }
        p.status = Status::Refunded;
        p.closed_at = now;
        save_pledge(&env, &p);
        token::Client::new(&env, &token(&env)).transfer(
            &env.current_contract_address(),
            &p.sender,
            &p.amount,
        );
        Refunded {
            id,
            sender: p.sender,
            amount: p.amount,
        }
        .publish(&env);
    }

    pub fn get_pledge(env: Env, id: u64) -> Pledge {
        load_pledge(&env, id)
    }

    pub fn get_clinic(env: Env, clinic: Address) -> Option<Clinic> {
        env.storage().persistent().get(&Key::Clinic(clinic))
    }

    pub fn next_id(env: Env) -> u64 {
        env.storage().instance().get(&Key::NextId).unwrap_or(1)
    }

    pub fn token(env: Env) -> Address {
        token(&env)
    }

    pub fn admin(env: Env) -> Address {
        admin(&env)
    }
}

#[cfg(test)]
mod test;
