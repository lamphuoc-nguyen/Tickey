import { useRef, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Button, Copy, Heading, Icon, QueryState, Screen, c, fonts, ui } from '@/components/ui';
import { TabBar } from '@/components/tab-bar';
import { useCategories, useEvents } from '../hooks/use-catalog';
import { EventCard } from '../components/event-card';

export default function HomeScreen() {
  const events = useEvents(),
    featured = useEvents({ featured: true }),
    categories = useCategories();
  const [page, setPage] = useState(0);
  const slider = useRef<ScrollView>(null);
  const width = useWindowDimensions().width - 40;
  const [eventRailWidth, setEventRailWidth] = useState(0);
  const eventCardGap = 10;
  const eventCardWidth = Math.max(1, ((eventRailWidth || width) - 2 * eventCardGap) / 2.3);
  const data = events.data?.pages.flat() ?? [],
    banners = featured.data?.pages.flat() ?? [];
  return (
    <Screen
      back={false}
      footer={<TabBar current="/" />}
      refreshControl={
        <RefreshControl
          refreshing={events.isRefetching}
          onRefresh={() => {
            void events.refetch();
            void featured.refetch();
            void categories.refetch();
          }}
          tintColor={c.primary}
        />
      }
      contentStyle={{ paddingTop: 8, gap: 0 }}
    >
      <View style={[ui.row, { marginBottom: 8 }]}>
        <Copy style={{ color: c.muted, fontFamily: fonts.semibold, fontSize: 12 }}>Khám phá sự kiện</Copy>
      </View>
      <Copy
        accessibilityRole="header"
        style={{ fontFamily: fonts.editorial, fontSize: 30, lineHeight: 44, marginBottom: 10 }}
      >
        {'Cuối tuần này,\nbạn có hẹn.'}
      </Copy>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tìm sự kiện"
        onPress={() => router.push('/search')}
        style={[ui.card, ui.row, { borderRadius: 999, minHeight: 56, marginBottom: 6 }]}
      >
        <Icon name="search" />
        <Copy style={{ fontSize: 12, color: c.muted }}>Tìm sự kiện</Copy>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 18 }}
        contentContainerStyle={{ flexGrow: 1, alignItems: 'stretch', gap: 7 }}
      >
        {(categories.data ?? []).slice(0, 3).map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/search',
                params: { categoryId: category.id, categoryName: category.name },
              })
            }
            style={[
              ui.card,
              {
                flexGrow: 1,
                flexShrink: 0,
                flexBasis: 70,
                minWidth: 70,
                alignItems: 'center',
                padding: 6,
                gap: 3,
                minHeight: 55,
                borderRadius: 10,
              },
            ]}
          >
            <Icon
              name={
                category.slug === 'am-nhac' || category.slug.includes('music')
                  ? 'music'
                  : category.slug === 'hoi-thao' || category.slug.includes('workshop')
                    ? 'users'
                    : 'building'
              }
            />
            <Copy style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>
              {category.name}
            </Copy>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/search')}
          style={[
            ui.card,
            {
              flexGrow: 1.3,
              flexShrink: 0,
              flexBasis: 84,
              minWidth: 84,
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 6,
              gap: 3,
              minHeight: 55,
              borderRadius: 10,
            },
          ]}
        >
          <Icon name="calendar" />
          <Copy numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 }}>
            Tất cả
          </Copy>
        </Pressable>
      </ScrollView>
      <QueryState error={categories.error} retry={() => void categories.refetch()} />
      <QueryState
        loading={featured.isPending}
        error={featured.error}
        retry={() => void featured.refetch()}
        empty={!featured.isPending && !featured.error && !banners.length}
        emptyText="Chưa có sự kiện nổi bật."
        compact
      />
      {!!banners.length && (
        <>
          <ScrollView
            ref={slider}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width + 12}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (width + 12)))}
          >
            {banners.map((event) => (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={`Xem ${event.title}`}
                onPress={() => router.push({ pathname: '/events/[eventId]', params: { eventId: event.id } })}
                style={{
                  width,
                  height: 210,
                  marginRight: 12,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: c.navy,
                }}
              >
                {event.coverImageUrl && (
                  <Image
                    source={event.coverImageUrl}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                )}
                <View
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backgroundColor: c.navy,
                    opacity: 0.4,
                  }}
                />
                <View style={{ flex: 1, padding: 20, gap: 8, justifyContent: 'space-between' }}>
                  <Copy style={{ fontFamily: fonts.semibold, color: 'white', fontSize: 10, lineHeight: 15 }}>
                    ĐÁNG CHỜ ĐỢI
                  </Copy>
                  <Copy
                    numberOfLines={2}
                    style={{ fontFamily: fonts.editorial, color: 'white', fontSize: 27, lineHeight: 40 }}
                  >
                    {event.title}
                  </Copy>
                  <Copy style={{ fontFamily: fonts.semibold, color: 'white' }}>Xem các suất diễn</Copy>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, flexWrap: 'wrap', marginTop: 4 }}
          >
            {banners.map((e, i) => (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityState={{ selected: i === page }}
                accessibilityLabel={`Sự kiện nổi bật ${i + 1}`}
                onPress={() => {
                  slider.current?.scrollTo({ x: i * (width + 12), animated: true });
                  setPage(i);
                }}
                style={{ height: 48, width: 48, justifyContent: 'center', alignItems: 'center' }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === page ? c.accent : c.gray,
                  }}
                />
              </Pressable>
            ))}
          </View>
        </>
      )}
      <View style={[ui.row, { justifyContent: 'space-between', marginTop: 2, marginBottom: 8 }]}>
        <Heading small>Một lịch hẹn khác</Heading>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/search')}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Copy style={{ fontSize: 12, color: c.primary, fontFamily: fonts.semibold }}>Xem tất cả</Copy>
        </Pressable>
      </View>
      <QueryState
        loading={events.isPending}
        error={events.error}
        empty={!events.isPending && !events.error && !data.length}
        retry={() => void events.refetch()}
        emptyText="Chưa có sự kiện được công bố."
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setEventRailWidth(event.nativeEvent.layout.width)}
        contentContainerStyle={{ gap: eventCardGap }}
        snapToInterval={eventCardWidth + eventCardGap}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {data.map((event) => (
          <EventCard key={event.id} event={event} small width={eventCardWidth} />
        ))}
      </ScrollView>
      {events.hasNextPage && (
        <Button secondary busy={events.isFetchingNextPage} onPress={() => void events.fetchNextPage()}>
          Xem thêm sự kiện
        </Button>
      )}
    </Screen>
  );
}
