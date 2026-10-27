import { sessionScope } from '@/lib/session-scope';
import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { reportInputSchema, type bankInputSchema, type supportInputSchema } from '@event/core';
import type { z } from 'zod';
import { repositories } from '@/lib/repositories';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';
import { evidenceMimeType, validateEvidence } from '../evidence-file';

export function useRefund(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['refund', ...sessionScope(session), id],
    queryFn: ({ signal }) => repositories.customer.refund(id, signal),
    enabled: !!session && session.workspace.kind === 'CUSTOMER' && !!id,
    refetchInterval: 10000,
  });
}
export function useReport(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['report', ...sessionScope(session), id],
    queryFn: ({ signal }) => repositories.customer.report(id, signal),
    enabled: !!session && session.workspace.kind === 'CUSTOMER' && !!id,
  });
}
export function useSupportRequest(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['support-request', ...sessionScope(session), id],
    queryFn: ({ signal }) => repositories.customer.support(id, signal),
    enabled: !!session && session.workspace.kind === 'CUSTOMER' && !!id,
    refetchInterval: 15000,
  });
}
export function useSupportActions() {
  const cache = useQueryClient();
  const uploaded = useRef(new Map<string, string>());
  const { session } = useAuth();
  return {
    pickEvidence: useExclusiveMutation('pick-evidence', {
      mutationFn: async () => {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
          multiple: true,
          copyToCacheDirectory: true,
        });
        if (result.canceled) return [];
        validateEvidence(result.assets);
        return result.assets;
      },
    }),
    report: useExclusiveMutation('submit-report', {
      retry: false,
      mutationFn: async (
        p: {
          input: Omit<z.input<typeof reportInputSchema>, 'attachmentPaths'>;
          assets: DocumentPicker.DocumentPickerAsset[];
        },
        assertCurrent,
      ) => {
        reportInputSchema.parse({ ...p.input, attachmentPaths: [] });
        validateEvidence(p.assets);
        const paths: string[] = [];
        for (const asset of p.assets) {
          await assertCurrent();
          const key = `${session?.userId}:${asset.uri}`;
          const existing = uploaded.current.get(key);
          if (existing) {
            paths.push(existing);
            continue;
          }
          const form = new FormData();
          form.append('purpose', 'REPORT_EVIDENCE');
          if (Platform.OS === 'web' && asset.file)
            form.append(
              'file',
              asset.file.type ? asset.file : new Blob([asset.file], { type: evidenceMimeType(asset) }),
              asset.name,
            );
          else
            form.append('file', {
              uri: asset.uri,
              name: asset.name,
              type: evidenceMimeType(asset),
            } as unknown as Blob);
          const upload = await repositories.customer.uploadEvidence(form);
          uploaded.current.set(key, upload.path);
          paths.push(upload.path);
        }
        await assertCurrent();
        return repositories.customer.submitReport({ ...p.input, attachmentPaths: paths });
      },
      onSuccess: () => {
        void cache.invalidateQueries({ queryKey: ['reports'] });
      },
    }),
    createSupport: useExclusiveMutation('create-support', {
      mutationFn: (input: z.infer<typeof supportInputSchema>) => repositories.customer.createSupport(input),
      onSuccess: () => cache.invalidateQueries({ queryKey: ['support'] }),
    }),
    message: useExclusiveMutation('support-message', {
      mutationFn: (p: { id: string; body: string }) => repositories.customer.supportMessage(p.id, p.body),
      onSuccess: () => {
        void cache.invalidateQueries({ queryKey: ['support-request'] });
        void cache.invalidateQueries({ queryKey: ['support'] });
      },
    }),
    bankInfo: useExclusiveMutation('bank-info', {
      mutationFn: (p: { id: string; input: z.infer<typeof bankInputSchema> }) =>
        repositories.customer.bankInfo(p.id, p.input),
      onSuccess: () => {
        void cache.invalidateQueries({ queryKey: ['refund'] });
        void cache.invalidateQueries({ queryKey: ['refunds'] });
      },
    }),
  };
}
