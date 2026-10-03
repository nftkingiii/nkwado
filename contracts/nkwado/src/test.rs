extern crate std;

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
};

struct Setup<'a> {
    env: Env,
    client: NkwadoClient<'a>,
    usdc: TokenClient<'a>,
    sender: Address,
    clinic: Address,
    other_clinic: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let usdc = TokenClient::new(&env, &sac.address());
    StellarAssetClient::new(&env, &sac.address());

    let id = env.register(Nkwado, (admin.clone(), sac.address()));
    let client = NkwadoClient::new(&env, &id);

    let sender = Address::generate(&env);
    StellarAssetClient::new(&env, &sac.address()).mint(&sender, &1_000_0000000);

    let clinic = Address::generate(&env);
    let other_clinic = Address::generate(&env);
    client.set_clinic(
        &clinic,
        &String::from_str(&env, "Lagoon Imaging"),
        &String::from_str(&env, "Enugu"),
        &true,
    );
    client.set_clinic(
        &other_clinic,
        &String::from_str(&env, "Other Diagnostics"),
        &String::from_str(&env, "Lagos"),
        &true,
    );

    Setup {
        env,
        client,
        usdc,
        sender,
        clinic,
        other_clinic,
    }
}

fn code(env: &Env, s: &str) -> (Bytes, BytesN<32>) {
    let b = Bytes::from_slice(env, s.as_bytes());
    let h: BytesN<32> = env.crypto().sha256(&b).into();
    (b, h)
}

const AMT: i128 = 45_0000000;

fn e(x: Error) -> soroban_sdk::Error {
    soroban_sdk::Error::from_contract_error(x as u32)
}

fn make_pledge(s: &Setup, secret: &str) -> (u64, Bytes) {
    let (c, h) = code(&s.env, secret);
    let exp = s.env.ledger().timestamp() + 7 * 24 * 3600;
    let id = s
        .client
        .pledge(&s.sender, &s.clinic, &symbol_short!("XRAY"), &AMT, &exp, &h);
    (id, c)
}

#[test]
fn pledge_locks_funds() {
    let s = setup();
    let before = s.usdc.balance(&s.sender);
    let (id, _) = make_pledge(&s, "secret-1");
    assert_eq!(id, 1);
    assert_eq!(s.usdc.balance(&s.sender), before - AMT);
    assert_eq!(s.usdc.balance(&s.client.address), AMT);
    let p = s.client.get_pledge(&id);
    assert_eq!(p.status, Status::Open);
    assert_eq!(p.clinic, s.clinic);
    assert_eq!(s.client.next_id(), 2);
}

#[test]
fn clinic_redeems_with_code() {
    let s = setup();
    let (id, c) = make_pledge(&s, "secret-1");
    s.client.redeem(&s.clinic, &id, &c);
    assert_eq!(s.usdc.balance(&s.clinic), AMT);
    assert_eq!(s.usdc.balance(&s.client.address), 0);
    let p = s.client.get_pledge(&id);
    assert_eq!(p.status, Status::Redeemed);
    assert_eq!(p.closed_at, 1_000_000);
}

#[test]
fn second_redeem_is_rejected() {
    let s = setup();
    let (id, c) = make_pledge(&s, "secret-1");
    s.client.redeem(&s.clinic, &id, &c);
    let r = s.client.try_redeem(&s.clinic, &id, &c);
    assert_eq!(r, Err(Ok(e(Error::NotOpen))));
    assert_eq!(s.usdc.balance(&s.clinic), AMT);
}

#[test]
fn wrong_clinic_is_rejected() {
    let s = setup();
    let (id, c) = make_pledge(&s, "secret-1");
    let r = s.client.try_redeem(&s.other_clinic, &id, &c);
    assert_eq!(r, Err(Ok(e(Error::WrongClinic))));
    assert_eq!(s.usdc.balance(&s.client.address), AMT);
}

#[test]
fn bad_code_is_rejected() {
    let s = setup();
    let (id, _) = make_pledge(&s, "secret-1");
    let (wrong, _) = code(&s.env, "guess");
    let r = s.client.try_redeem(&s.clinic, &id, &wrong);
    assert_eq!(r, Err(Ok(e(Error::BadCode))));
}

#[test]
fn redeem_after_expiry_is_rejected_and_refund_works() {
    let s = setup();
    let (id, c) = make_pledge(&s, "secret-1");
    let before = s.usdc.balance(&s.sender);
    s.env.ledger().set_timestamp(1_000_000 + 7 * 24 * 3600);
    assert_eq!(
        s.client.try_redeem(&s.clinic, &id, &c),
        Err(Ok(e(Error::Expired)))
    );
    s.client.refund(&id);
    assert_eq!(s.usdc.balance(&s.sender), before + AMT);
    assert_eq!(s.client.get_pledge(&id).status, Status::Refunded);
    assert_eq!(s.client.try_refund(&id), Err(Ok(e(Error::NotOpen))));
}

#[test]
fn early_refund_is_rejected() {
    let s = setup();
    let (id, _) = make_pledge(&s, "secret-1");
    assert_eq!(s.client.try_refund(&id), Err(Ok(e(Error::NotExpired))));
}

#[test]
fn unverified_or_inactive_clinic_cannot_receive() {
    let s = setup();
    let (_, h) = code(&s.env, "x");
    let exp = s.env.ledger().timestamp() + 3600;
    let stranger = Address::generate(&s.env);
    assert_eq!(
        s.client
            .try_pledge(&s.sender, &stranger, &symbol_short!("XRAY"), &AMT, &exp, &h),
        Err(Ok(e(Error::ClinicNotVerified)))
    );
    s.client.set_clinic(
        &s.clinic,
        &String::from_str(&s.env, "Lagoon Imaging"),
        &String::from_str(&s.env, "Enugu"),
        &false,
    );
    assert_eq!(
        s.client
            .try_pledge(&s.sender, &s.clinic, &symbol_short!("XRAY"), &AMT, &exp, &h),
        Err(Ok(e(Error::ClinicNotVerified)))
    );
}

#[test]
fn invalid_amount_and_expiry_rejected() {
    let s = setup();
    let (_, h) = code(&s.env, "x");
    let now = s.env.ledger().timestamp();
    assert_eq!(
        s.client
            .try_pledge(&s.sender, &s.clinic, &symbol_short!("XRAY"), &0, &(now + 3600), &h),
        Err(Ok(e(Error::InvalidAmount)))
    );
    assert_eq!(
        s.client
            .try_pledge(&s.sender, &s.clinic, &symbol_short!("XRAY"), &AMT, &now, &h),
        Err(Ok(e(Error::InvalidExpiry)))
    );
    assert_eq!(
        s.client.try_pledge(
            &s.sender,
            &s.clinic,
            &symbol_short!("XRAY"),
            &AMT,
            &(now + 91 * 24 * 3600),
            &h
        ),
        Err(Ok(e(Error::InvalidExpiry)))
    );
}

#[test]
fn set_clinic_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let id = env.register(Nkwado, (admin, sac.address()));
    let client = NkwadoClient::new(&env, &id);
    let r = client.try_set_clinic(
        &Address::generate(&env),
        &String::from_str(&env, "x"),
        &String::from_str(&env, "y"),
        &true,
    );
    assert!(r.is_err());
}
