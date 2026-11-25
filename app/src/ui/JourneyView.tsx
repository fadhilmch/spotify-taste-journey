import React from 'react';
import {
  artistEras,
  filterToMonths,
  fmtMinutes,
  monthLabel,
  rangeMonthKeys,
  topArtists,
} from '../data/stats';
import type { MonthBucket, PlayAggregate } from '../data/types';
import { useAppStore } from '../state/store';
import { artistBackground, artistHue } from './theme';
import { Section } from './primitives';

export function JourneyView({ months, aggs }: { months: MonthBucket[]; aggs: PlayAggregate[] }) {
  const range = useAppStore((s) => s.range);
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);
  const setPlaying = useAppStore((s) => s.setPlaying);

  const rangeKeys = React.useMemo(() => rangeMonthKeys(months, range), [months, range]);
  const total = React.useMemo(
    () => filterToMonths(aggs, rangeKeys).reduce((s, a) => s + a.ms, 0) / 60000,
    [aggs, rangeKeys],
  );
  const maxMin = Math.max(1, ...months.map((m) => m.minutes));
  const curKey = month ?? months[months.length - 1]?.key;
  const cur = months.find((m) => m.key === curKey) ?? months[months.length - 1];
  const curAggs = cur ? aggs.filter((a) => a.month === cur.key) : [];
  const curTop = topArtists(curAggs, 3);
  const eras = React.useMemo(() => artistEras(months, aggs), [months, aggs]);
  const spans = React.useMemo(() => {
    const idx = new Map(months.map((m, i) => [m.key, i]));
    return eras.map((e) => ({
      ...e,
      count: (idx.get(e.to) ?? 0) - (idx.get(e.from) ?? 0) + 1,
      label: `${e.artist}, ${monthLabel(e.from).label} to ${monthLabel(e.to).label}`,
    }));
  }, [eras, months]);
  const longEras = spans.filter((e) => e.count >= 2);
  const oneMonth = spans.length - longEras.length;
  const rangeLabel =
    { '4w': 'Last month', '6m': '6 months', '1y': '1 year', all: 'All time' }[range] ?? range;

  return (
    <>
      <Section
        id="tj-journey-h"
        title={'Listening over time'}
        aside={
          <>
            {fmtMinutes(total)} - {rangeLabel}
          </>
        }
      >
        <div className="tj-chart" role="img" aria-label="Monthly listening minutes">
          {months.map((m, i) => (
            <button
              key={m.key}
              type="button"
              className={
                'tj-bar' + (m.key === cur?.key ? ' is-on' : '') + (rangeKeys.has(m.key) ? '' : ' is-dim')
              }
              style={{
                height: `${Math.max(6, (m.minutes / maxMin) * 100)}%`,
                animationDelay: `${Math.min(i, 30) * 14}ms`,
              }}
              onClick={() => {
                setMonth(m.key);
                setPlaying(false);
              }}
              aria-label={`${m.label}, ${fmtMinutes(m.minutes)}`}
            />
          ))}
        </div>
        <div className="tj-chart-x">
          <span>{months[0]?.label}</span>
          <span>{months[months.length - 1]?.label}</span>
        </div>
      </Section>

      {cur && (
        <Section id="tj-month-h" title={cur.label} aside={fmtMinutes(cur.minutes)}>
          {curTop.length > 0 ? (
            <ol className="tj-mini">
              {curTop.map((t, i) => (
                <li key={t.name}>
                  <span className="tj-rank">{i + 1}</span>
                  <span className="tj-thumb" style={{ background: artistBackground(t.name) }} />
                  <span className="tj-mini-name">{t.name}</span>
                  <span className="tj-mini-val">{fmtMinutes(t.minutes)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="tj-note">No listening recorded this month.</p>
          )}
        </Section>
      )}

      <Section id="tj-eras-h" title={'Artist eras'} aside={'Who led each stretch'}>
        <div className="tj-ribbon" role="group" aria-label="Artist eras across your history">
          {spans.map((e) => (
            <button
              key={e.artist + e.from}
              type="button"
              className={'tj-ribbon-seg' + (e.from <= curKey! && curKey! <= e.to ? ' is-on' : '')}
              style={{ flexGrow: e.count, background: `hsl(${artistHue(e.artist)} 22% 34%)` }}
              title={e.label}
              aria-label={e.label}
              aria-pressed={e.from <= curKey! && curKey! <= e.to}
              onClick={() => {
                setMonth(e.to);
                setPlaying(false);
              }}
            />
          ))}
        </div>
        {longEras.length > 0 && (
          <ol className="tj-era-list">
            {longEras.map((e) => (
              <li key={e.artist + e.from}>
                <span className="tj-era-list-name">{e.artist}</span>
                <span className="tj-era-list-when">
                  {monthLabel(e.from).label} to {monthLabel(e.to).label}
                </span>
                <span className="tj-era-list-n">{e.count} months</span>
              </li>
            ))}
          </ol>
        )}
        {oneMonth > 0 && (
          <p className="tj-note">
            Plus {oneMonth} one-month {oneMonth === 1 ? 'lead' : 'leads'}
          </p>
        )}
      </Section>
    </>
  );
}
