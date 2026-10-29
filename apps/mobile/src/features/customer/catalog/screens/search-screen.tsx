import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Disclosure, TextAction } from '@/components/customer-controls';
import { Button, Copy, Heading, QueryState, c, ui } from '@/components/ui';
import { CustomerBrowseScreen } from '@/components/customer-browse-screen';
import { useCategories, useEvents } from '../hooks/use-catalog';
import { EventCard } from '../components/event-card';
import { EventSearchField } from '../components/event-search-field';
import { useFormDraft } from '@/features/forms/use-form-draft';
export default function SearchScreen() {
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { draft, update } = useFormDraft(`search:${params.categoryId ?? 'all'}`, {
    text: '',
    q: '',
    categoryId: params.categoryId ?? '',
  });
  useEffect(() => {
    const timer = setTimeout(() => update({ q: draft.text.trim() }), 300);
    return () => clearTimeout(timer);
  }, [draft.text, update]);
  const query = useEvents({ q: draft.q, categoryId: draft.categoryId || undefined }),
    categories = useCategories();
  const events = query.data?.pages.flat() ?? [];
  return (
    <CustomerBrowseScreen tab="/">
      <Heading>Tìm sự kiện</Heading>
      <EventSearchField
        value={draft.text}
        onChange={(text) => update({ text, ...(!text ? { q: '' } : {}) })}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {[{ id: '', name: 'Tất cả' }, ...(categories.data ?? [])].map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.categoryId === category.id }}
            onPress={() => update({ categoryId: category.id })}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: draft.categoryId === category.id ? c.primaryContainer : c.amberTint,
            }}
          >
            <Copy numberOfLines={1} style={draft.categoryId === category.id ? ui.semibold : undefined}>
              {category.name}
            </Copy>
          </Pressable>
        ))}
      </ScrollView>
      {(!!draft.q || !!draft.categoryId) && (
        <TextAction onPress={() => update({ text: '', q: '', categoryId: '' })}>Xóa bộ lọc</TextAction>
      )}
      <QueryState error={categories.error} retry={() => void categories.refetch()} compact />
      <Disclosure title="Bộ lọc khác">
        <View style={[ui.row, { alignItems: 'flex-start', flexWrap: 'wrap' }]}>
          {[
            { label: 'Thời gian', reason: 'Lọc theo tháng chưa được hỗ trợ.' },
            { label: 'Địa điểm', reason: 'Lọc theo địa điểm chưa được hỗ trợ.' },
          ].map((filter) => (
            <View key={filter.label} style={{ flex: 1, minWidth: 120 }}>
              <Pressable
                disabled
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityHint={filter.reason}
                style={{ minHeight: 48, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border }}
              >
                <Copy style={ui.muted}>{filter.label}</Copy>
              </Pressable>
            </View>
          ))}
        </View>
        <Copy style={[ui.muted, { fontSize: 12 }]}>Lọc thời gian và địa điểm chưa khả dụng.</Copy>
      </Disclosure>
      {!!events.length && <Heading small>Kết quả tìm kiếm</Heading>}
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !events.length}
        emptyText="Không tìm thấy sự kiện phù hợp."
      />
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} secondary>
          Xem thêm sự kiện
        </Button>
      )}
    </CustomerBrowseScreen>
  );
}
