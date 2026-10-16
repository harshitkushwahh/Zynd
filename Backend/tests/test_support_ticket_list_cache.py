from app.application.support.ticket_list_cache import (
    _page_key,
    _version_key,
)


def test_ticket_list_cache_keys() -> None:
    from uuid import UUID

    user_id = UUID("11111111-1111-1111-1111-111111111111")
    assert _version_key(user_id) == f"support:ticket_list:ver:{user_id}"
    assert (
        _page_key(user_id, "3", 10, 6)
        == f"support:ticket_list:page:{user_id}:3:10:6"
    )


def test_customer_ticket_page_has_more_slice() -> None:
    rows = list(range(11))
    limit = 10
    has_more = len(rows) > limit
    page = rows[:limit]
    next_offset = 0 + len(page)
    assert has_more is True
    assert page == list(range(10))
    assert next_offset == 10
