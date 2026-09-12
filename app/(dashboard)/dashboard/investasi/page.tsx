"use client";

import React from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { AFFILIATE_PARTNERS } from "@/lib/constants/affiliates";
import { TrendingUpIcon, ShieldIcon, SparkleIcon } from "@/components/ui/Icons";

export default function InvestasiPage() {
  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-24 space-y-5">
      {/* Header & Back */}
      <div>
        <Link
          href="/dashboard/dompet"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-text mb-2 transition-colors"
        >
          <span>← Kembali ke Dompet</span>
        </Link>
        <span className="text-[12px] font-medium text-text-secondary block">
          Mitra Platform & Edukasi
        </span>
        <h1 className="text-[20px] font-bold text-text flex items-center gap-2">
          <TrendingUpIcon className="w-5 h-5 text-primary" />
          <span>Kembangkan Uangmu</span>
        </h1>
      </div>

      {/* Disclaimer Wajib Permanen di Bagian Atas Halaman per PRD §3.5 */}
      <div className="p-4 bg-field rounded-card-lg border border-border space-y-1">
        <div className="flex items-center gap-2 text-text font-bold text-[13px]">
          <ShieldIcon className="w-4 h-4 text-primary flex-shrink-0" />
          <span>Bukan Nasihat Keuangan (Disclaimer)</span>
        </div>
        <p className="text-[11px] text-text-secondary leading-relaxed">
          Informasi yang disajikan di halaman ini bertujuan sebagai sarana edukasi dan referensi platform berizin. Seluruh keputusan dan risiko penempatan investasi berada sepenuhnya dalam kewenangan dan tanggung jawab pribadi Anda.
        </p>
      </div>

      {/* Prinsip Edukasi Finansial Orisinal (Bahasa Sendiri, Bukan Kutipan Buku) */}
      <div className="bg-surface p-4 rounded-card-lg border border-border space-y-2.5">
        <div className="flex items-center gap-2">
          <SparkleIcon className="w-4 h-4 text-primary" />
          <h2 className="text-[14px] font-bold text-text">
            3 Kaidah Menumbuhkan Dana Abadi
          </h2>
        </div>
        <div className="space-y-2 text-[12px] text-text-secondary leading-relaxed">
          <div className="p-2.5 bg-field rounded-control">
            <strong className="text-text block mb-0.5">1. Mulai dari yang Rutin, Bukan yang Besar</strong>
            Konsistensi menyisihkan sebagian kecil penghasilan di awal bulan jauh lebih berdampak daripada menunggu memiliki modal besar.
          </div>
          <div className="p-2.5 bg-field rounded-control">
            <strong className="text-text block mb-0.5">2. Utamakan Legalitas dan Pengawasan Resmi</strong>
            Pilihlah instrumen dan penyelenggara yang memiliki perizinan jelas dari regulator resmi (OJK / Bappebti) demi keamanan dana jangka panjang.
          </div>
          <div className="p-2.5 bg-field rounded-control">
            <strong className="text-text block mb-0.5">3. Seimbangkan Risiko dengan Jangka Waktu</strong>
            Gunakan instrumen berisiko rendah (pasar uang/SBN) untuk kebutuhan dana siaga, dan instrumen indeks/saham untuk target di atas 5–10 tahun.
          </div>
        </div>
      </div>

      {/* Daftar Mitra Platform Investasi Terverifikasi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-text">
            Pilihan Platform Mitra Terpercaya
          </h2>
          <span className="text-[11px] text-text-secondary">
            {AFFILIATE_PARTNERS.length} Platform
          </span>
        </div>

        {AFFILIATE_PARTNERS.map((partner) => (
          <div
            key={partner.id}
            className="bg-surface p-4 rounded-card-lg border border-border hover:border-primary/40 transition-all space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold text-text">{partner.name}</h3>
                  {partner.isPopular && (
                    <span className="px-2 py-0.5 bg-chip text-primary text-[10px] font-bold rounded-full">
                      Pilihan Populer
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-text-secondary block">
                  {partner.category}
                </span>
              </div>

              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-income bg-income/10 px-2 py-1 rounded-control whitespace-nowrap">
                {partner.regulationBadge}
              </span>
            </div>

            <p className="text-[12px] text-text-secondary leading-relaxed">
              {partner.description}
            </p>

            {/* Asset Tags */}
            <div className="flex flex-wrap gap-1.5">
              {partner.assetTypes.map((asset) => (
                <span
                  key={asset}
                  className="px-2 py-0.5 bg-field text-text-secondary text-[10px] font-medium rounded-control"
                >
                  {asset}
                </span>
              ))}
              <span className="px-2 py-0.5 bg-field text-primary text-[10px] font-bold rounded-control ml-auto">
                {partner.minimumInvestment}
              </span>
            </div>

            {/* Referral / Affiliate CTA */}
            <div className="pt-2 border-t border-border flex items-center justify-between gap-3">
              {partner.referralCode ? (
                <div className="text-[11px] text-text-secondary">
                  Kode Promo: <strong className="text-primary font-bold">{partner.referralCode}</strong>
                </div>
              ) : (
                <div className="text-[11px] text-text-secondary">Registrasi Online Instan</div>
              )}

              <a
                href={partner.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-control hover:opacity-90 active:scale-95 transition-all"
              >
                <span>Buka Akun</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
