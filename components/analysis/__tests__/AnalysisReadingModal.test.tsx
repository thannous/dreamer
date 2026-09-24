import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Modal } from 'react-native';
import { AnalysisReadingModal } from '../AnalysisReadingModal';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  return { __esModule: true, default: ({ children, ...props }: any) => React.createElement('Modal', props, children) };
});
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  const ScrollView = ({ children, ...props }: any) => React.createElement('ScrollView', props, children);
  ScrollView.Context = React.createContext(null);
  return { __esModule: true, default: ScrollView };
});
jest.mock('expo-image', () => ({ Image: require('react-native').Image }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'light' }) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/motion', () => ({ PressableScale: require('react-native').Pressable }));

const dream = { title: 'Un nouveau départ', shareableQuote: 'Le voyage commence.', interpretation: 'La gare pourrait évoquer une transition.', imageUrl: '',
  symbols: [{ name: 'La gare', meaning: 'Un lieu de passage, présent dans le récit.' }],
  emotions: [{ name: 'Joie', insight: 'Tu dis « je suis heureux ».' }],
  reflectionQuestions: ['Que représente cette gare pour toi ?'] };

it('supports close and system back', () => {
  const onClose = jest.fn();
  const view = render(<AnalysisReadingModal dream={dream} onClose={onClose} />);
  fireEvent.press(view.getByTestId('analysis.reading.close'));
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  expect(onClose).toHaveBeenCalledTimes(2);
});

it('updates queued, running and completed illustration without hiding or regenerating the reading', () => {
  const onRetryImage = jest.fn();
  const view = render(<AnalysisReadingModal dream={{ ...dream, imageJobStatus: 'queued' }} onRetryImage={onRetryImage} onClose={jest.fn()} />);
  expect(view.getByText('analysis.reading.image_queued')).toBeTruthy();
  const readingOrder = JSON.stringify(view.toJSON());
  expect(readingOrder.indexOf('analysis.reading.body')).toBeLessThan(readingOrder.indexOf('analysis.reading.illustration'));
  view.rerender(<AnalysisReadingModal dream={{ ...dream, imageJobStatus: 'running' }} onRetryImage={onRetryImage} onClose={jest.fn()} />);
  expect(view.getByText('analysis.reading.image_generating')).toBeTruthy();
  expect(view.getByTestId('analysis.reading.generation_dots', { includeHiddenElements: true })).toBeTruthy();
  expect(view.getByText(dream.interpretation)).toBeTruthy();
  view.rerender(<AnalysisReadingModal dream={{ ...dream, imageUrl: 'private-reference' }} imageUri="https://example.com/signed.webp" onRetryImage={onRetryImage} onClose={jest.fn()} />);
  expect(view.getByTestId('analysis.reading.image').props.source).toEqual({ uri: 'https://example.com/signed.webp' });
  expect(view.queryByTestId('analysis.reading.generation_dots', { includeHiddenElements: true })).toBeNull();
  fireEvent(view.getByTestId('analysis.reading.image'), 'load');
  expect(view.queryByText('analysis.reading.image_loading')).toBeNull();
  expect(view.getByText(dream.interpretation)).toBeTruthy();
  expect(onRetryImage).not.toHaveBeenCalled();
});

it('only exposes generation retry when the parent allows it', () => {
  const onRetryImage = jest.fn();
  const failed = { ...dream, imageGenerationFailed: true };
  const view = render(<AnalysisReadingModal dream={failed} onClose={jest.fn()} />);
  expect(view.queryByTestId('analysis.reading.image_retry')).toBeNull();
  view.rerender(<AnalysisReadingModal dream={failed} onRetryImage={onRetryImage} onClose={jest.fn()} />);
  fireEvent.press(view.getByTestId('analysis.reading.image_retry'));
  expect(onRetryImage).toHaveBeenCalledTimes(1);
  view.rerender(<AnalysisReadingModal dream={failed} onRetryImage={onRetryImage} isRetryingImage onClose={jest.fn()} />);
  expect(view.queryByTestId('analysis.reading.image_retry')).toBeNull();
});

it('reloads a failed image download without requesting another generation', () => {
  const onRetryImage = jest.fn();
  const onReloadImage = jest.fn();
  const view = render(<AnalysisReadingModal dream={{ ...dream, imageUrl: 'private-reference' }} imageUri="https://example.com/signed.webp"
    onRetryImage={onRetryImage} onReloadImage={onReloadImage} onClose={jest.fn()} />);
  fireEvent(view.getByTestId('analysis.reading.image'), 'error');
  expect(view.getByText('analysis.reading.image_unavailable')).toBeTruthy();
  fireEvent.press(view.getByTestId('analysis.reading.image_retry'));
  expect(onReloadImage).toHaveBeenCalledTimes(1);
  expect(onRetryImage).not.toHaveBeenCalled();
});

it('reports unavailable signed media instead of spinning forever', () => {
  const view = render(<AnalysisReadingModal dream={{ ...dream, imageUrl: 'private-reference' }} imageLoadFailed onReloadImage={jest.fn()} onClose={jest.fn()} />);
  expect(view.getByText('analysis.reading.image_unavailable')).toBeTruthy();
  expect(view.queryByText('analysis.reading.image_loading')).toBeNull();
});

it('preserves sparse and legacy analyses without fabricating missing sections', () => {
  const view = render(<AnalysisReadingModal dream={{ title: 'Fragment', interpretation: 'Un souvenir.', shareableQuote: '' }} onClose={jest.fn()} />);
  for (const key of ['symbols', 'emotions', 'questions']) expect(view.queryByTestId(`analysis.reading.${key}`)).toBeNull();
  expect(view.getByText('journal.detail.image.no_image_title')).toBeTruthy();
  expect(view.getByText('Un souvenir.')).toBeTruthy();
});

it('retains every section and attributes only server-stamped poetic quotes', () => {
  const view = render(<AnalysisReadingModal dream={dream} onClose={jest.fn()} />);
  for (const text of [dream.interpretation, dream.symbols[0].meaning, dream.emotions[0].insight]) {
    expect(view.getByText(text)).toBeTruthy();
  }
  expect(view.getByText(`1. ${dream.reflectionQuestions[0]}`)).toBeTruthy();
  expect(view.getByText('« Le voyage commence. »')).toBeTruthy();
  expect(view.queryByText('journal.detail.quote_attribution')).toBeNull();
  view.rerender(<AnalysisReadingModal dream={{ ...dream, promptVersion: 'analysis-2026-09-18.poetic3' }} onClose={jest.fn()} />);
  expect(view.getByText('journal.detail.quote_attribution')).toBeTruthy();
});

it('shares a versioned memory/disk image cache and resets loading when the image changes', () => {
  const view = render(<AnalysisReadingModal dream={{ ...dream, imageUrl: 'ref' }} imageUri="https://example.com/1"
    imageCacheKey="ref|1" onClose={jest.fn()} />);
  const image = view.getByTestId('analysis.reading.image');
  expect(image.props.source).toEqual({ uri: 'https://example.com/1', cacheKey: 'ref|1' });
  expect(image.props.cachePolicy).toBe('memory-disk');
  fireEvent(image, 'load');
  expect(view.queryByText('analysis.reading.image_loading')).toBeNull();
  view.rerender(<AnalysisReadingModal dream={{ ...dream, imageUrl: 'ref' }} imageUri="https://example.com/2"
    imageCacheKey="ref|2" onClose={jest.fn()} />);
  expect(view.getByTestId('analysis.reading.image').props.source.cacheKey).toBe('ref|2');
  expect(view.getByText('analysis.reading.image_loading')).toBeTruthy();
});
