import { NextRequest, NextResponse } from "next/server";
import { exigirLojaUser } from "@/lib/auth-helpers";
import {
  buscarDadosEmpresa,
  buscarSocios,
  buscarEmpresasDoSocio,
  lerCompliance,
} from "@/lib/consulta-cnpj";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const sessao = await exigirLojaUser(req, { rate_limite: 30 });
  if (sessao instanceof NextResponse) return sessao;

  const url = new URL(req.url);
  const cnpj = (url.searchParams.get("cnpj") || "").replace(/\D/g, "");
  if (cnpj.length !== 14) {
    return NextResponse.json({ ok: false, motivo: "CNPJ inválido" }, { status: 400 });
  }

  try {
    const [empresa, socios, compliance] = await Promise.all([
      buscarDadosEmpresa(cnpj),
      buscarSocios(cnpj),
      lerCompliance(cnpj),
    ]);

    if (!empresa) {
      return NextResponse.json({ ok: false, motivo: "CNPJ não encontrado" }, { status: 404 });
    }

    // Pra cada sócio, busca empresas em que aparece (limite 5 por sócio pra não pesar)
    const cruzamentos = await Promise.all(
      socios.slice(0, 10).map(async (s) => ({
        socio: s,
        empresas: await buscarEmpresasDoSocio(s.cnpj_cpf_socio, cnpj),
      })),
    );

    return NextResponse.json({
      ok: true,
      empresa,
      socios,
      cruzamentos,
      compliance,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[consulta-cnpj] erro:", msg);
    return NextResponse.json({ ok: false, motivo: "Falha na consulta" }, { status: 500 });
  }
}
