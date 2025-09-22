import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBookmark,
  FaBookmark as FaBookmarkSolid,
  FaClock,
  FaChartLine,
  FaUser,
  FaChevronRight,
} from "react-icons/fa";
import { useAuth } from "../../contexts/AuthContext";
import axios from "../../setupAxios";
import toast from "react-hot-toast";
import { BACKEND_URL } from "../../contexts/Bakendurl";
import ChipMarquee from "../common/ChipMarquee";

/* ========= Utils ========= */
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n ?? 0));
const kFormat = (n) => {
  const x = Number(n || 0);
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return x.toString();
};
const timeRemaining = (endDate) => {
  if (!endDate) return "—";
  const now = new Date();
  const end = new Date(endDate);
  const diff = end - now;
  if (Number.isNaN(end.getTime())) return "—";
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
const formatEndAt = (endDate) => {
  if (!endDate) return "—";
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/* ===== Subcomponente: fila de opción con “track” ===== */
/* ===== Subcomponente: fila de opción con “track” ===== */
const OptionTrack = ({ text, percentage }) => {
  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n ?? 0));
  const pct = clamp(percentage);

  // Tamaños compactos + respiración
  const FIXED_BTN_W = "w-16 md:w-20"; // ~64/80px
  const TRACK_H = "h-9";             // +1px de aire arriba/abajo
  const BTN_H = "h-6";               // más bajo que el track para que respire
  const RIGHT_GAP = "pr-2";          // + espacio a la derecha (antes pr-1)

  return (
    <div className={`relative ${TRACK_H} rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800 overflow-hidden`}>
      {/* Relleno del porcentaje */}
      <div
        className="absolute inset-y-0 left-0 bg-primary-500/30 dark:bg-primary-600/40"
        style={{ width: `${pct}%` }}
      />

      {/* % izquierda (mini) */}
      <div className="absolute inset-y-0 left-0 pl-2 pr-1 flex items-center">
        <span className="px-1.5 py-[2px] rounded-full text-[10px] font-semibold bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200 leading-none">
          {pct}%
        </span>
      </div>

      {/* Botón derecha — más aire arriba y a la derecha */}
      <div className={`absolute inset-y-0 right-0 ${RIGHT_GAP} flex items-center`}>
        <span
          className={`${FIXED_BTN_W} ${BTN_H} inline-flex items-center justify-center rounded-full text-[10px] font-semibold bg-bitcoin-500/90 text-gray-900 dark:bg-bitcoin-600 dark:text-gray-100 truncate`}
          title={text || "—"}
        >
          <span className="px-2 truncate">{text || "—"}</span>
        </span>
      </div>
    </div>
  );
};



const PollCard = ({ poll, compact = false }) => {
  const { isAuthenticated } = useAuth();
  const [isSaved, setIsSaved] = useState(Boolean(poll?.isSaved));
  const [saving, setSaving] = useState(false);

  const options = Array.isArray(poll?.options) ? poll.options : [];
  const tags = Array.isArray(poll?.tags) ? poll.tags : [];

  // Top-2 por porcentaje
  const top2 = useMemo(
    () => [...options].sort((a, b) => (b?.percentage || 0) - (a?.percentage || 0)).slice(0, 2),
    [options]
  );

  // Items de la marquesina
  const marqueeItems = useMemo(() => {
    const items = [];
    if (poll?.category) items.push({ type: "category", label: poll.category });
    if (poll?.subCategory) items.push({ type: "tag", label: poll.subCategory });
    if (poll?.createdBy?.username) items.push({ type: "author", label: poll.createdBy.username });
    tags.slice(0, 6).forEach((t) => items.push({ type: "tag", label: t }));
    if (poll?.featured) items.push({ type: "featured", label: "Featured" });
    if (poll?.trending) items.push({ type: "trending", label: "Trending" });
    return items;
  }, [poll, tags]);

  const handleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error("Please login to save polls");
      return;
    }
    try {
      setSaving(true);
      const res = await axios.post(`${BACKEND_URL}/api/polls/${poll._id}/save`);
      setIsSaved(res.data.saved);
      toast.success(res.data.message);
    } catch {
      toast.error("Failed to save poll");
    } finally {
      setSaving(false);
    }
  };

  /* ========== Variante compacta ========== */
  if (compact) {
    return (
      <Link to={`/poll/${poll._id}`} className="card-hover block p-4 h-full">
        <div className="flex flex-col h-full">
          {/* Fila superior: foto + título + bookmark */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                {poll?.image ? <img src={poll.image} alt={poll.title} className="w-full h-full object-cover" /> : null}
              </div>
              {/* Título limitado a altura de la imagen */}
              <div className="max-h-12 overflow-hidden">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight line-clamp-2">
                  {poll?.title}
                </h3>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              title={isSaved ? "Saved" : "Save"}
            >
              {saving ? (
                <span className="inline-block w-4 h-4 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
              ) : isSaved ? (
                <FaBookmarkSolid className="w-4 h-4 text-primary-600" />
              ) : (
                <FaBookmark className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Marquesina ancho completo */}
          {marqueeItems.length > 0 && (
            <div className="mt-2">
              <ChipMarquee items={marqueeItems} fadeEdges={false} />
            </div>
          )}

          {/* Meta central */}
          <div className="mt-3 space-y-1 text-[12px] text-gray-600 dark:text-gray-300">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 w-full">
              <span className="inline-flex items-center gap-2">
                <FaClock className="w-3.5 h-3.5 opacity-80" />
                Ends at {formatEndAt(poll?.endDate)}
                <span className="ml-2 text-gray-400 dark:text-gray-500">
                  ({timeRemaining(poll?.endDate)})
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 w-full">
              <span className="inline-flex items-center gap-2">
                <FaChartLine className="w-3.5 h-3.5 opacity-80" /> Vol. ${kFormat(poll?.totalVolume)}
              </span>
              {poll?.uniqueTraders != null && (
                <span className="inline-flex items-center gap-2">
                  <FaUser className="w-3.5 h-3.5 opacity-80" /> {kFormat(poll.uniqueTraders)}
                </span>
              )}
            </div>
          </div>

          {/* Opciones */}
          <div className="mt-3 space-y-2">
            {top2.map((opt, i) => (
              <OptionTrack key={i} text={opt?.text} percentage={opt?.percentage} />
            ))}
            {options.length > 2 && (
              <div className="text-[12px] text-gray-500 dark:text-gray-400">+{options.length - 2} more options</div>
            )}
          </div>

          {/* See All Options - pegado abajo */}
          <div className="mt-auto pt-2 flex items-center justify-end text-[12px] text-gray-400 dark:text-gray-500">
            <span>See All Options</span>
            <FaChevronRight className="w-3 h-3 ml-1" />
          </div>
        </div>
      </Link>
    );
  }

  /* ========== Card normal ========== */
  return (
    <div className="card-hover p-4 md:p-5 h-full">
      <Link to={`/poll/${poll._id}`} className="block h-full">
        <div className="flex flex-col h-full">
          {/* Fila superior: foto + título + bookmark */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                {poll?.image ? <img src={poll.image} alt={poll.title} className="w-full h-full object-cover" /> : null}
              </div>
              {/* Título limitado a altura de la imagen */}
              <div className="max-h-14 overflow-hidden">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight line-clamp-2">
                  {poll?.title}
                </h3>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              title={isSaved ? "Saved" : "Save"}
            >
              {saving ? (
                <span className="inline-block w-4 h-4 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
              ) : isSaved ? (
                <FaBookmarkSolid className="w-4 h-4 text-primary-600" />
              ) : (
                <FaBookmark className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Marquesina ancho completo */}
          {marqueeItems.length > 0 && (
            <div className="mt-2">
              <ChipMarquee items={marqueeItems} fadeEdges={false} />
            </div>
          )}

          {/* Meta central */}
          <div className="mb-4 mt-3 space-y-1 text-[13px] text-gray-600 dark:text-gray-300 w-full">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 w-full">
              <span className="inline-flex items-center gap-2">
                <FaClock className="w-3.5 h-3.5 opacity-80" />
                Ends at {formatEndAt(poll?.endDate)}
                <span className="ml-2 text-gray-400 dark:text-gray-500">
                  ({timeRemaining(poll?.endDate)})
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 w-full">
              <span className="inline-flex items-center gap-2">
                <FaChartLine className="w-3.5 h-3.5 opacity-80" /> Vol. ${kFormat(poll?.totalVolume)}
              </span>
              {poll?.uniqueTraders != null && (
                <span className="inline-flex items-center gap-2">
                  <FaUser className="w-3.5 h-3.5 opacity-80" /> {kFormat(poll.uniqueTraders)}
                </span>
              )}
            </div>
          </div>

          {/* Opciones */}
          <div className="space-y-2">
            {top2.map((opt, idx) => (
              <OptionTrack key={idx} text={opt?.text} percentage={opt?.percentage} />
            ))}
            {options.length > 2 && (
              <div className="text-[12px] text-gray-500 dark:text-gray-400">
                +{options.length - 2} more options
              </div>
            )}
          </div>

          {/* See All Options - pegado abajo */}
          <div className="mt-auto pt-2 flex items-center justify-end text-[12px] text-gray-400 dark:text-gray-500">
            <span>See All Options</span>
            <FaChevronRight className="w-3 h-3 ml-1" />
          </div>
        </div>
      </Link>
    </div>
  );
};

export default PollCard;
