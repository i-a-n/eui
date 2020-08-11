/**
 * NOTE: This component has been "broken off" from the EUI component of the same name.
 * See the original code that was copied over here:
 * https://github.com/elastic/eui/blob/f937f/src/components/context_menu/context_menu.tsx
 * Our changes to the component are confined entirely to the `maximumHeight` prop and
 * its use in calculating the Context Menu's height, and scrolling to the top of a panel
 * after its transition.
 *
 * This also requires a CSS change which lives in a sibling file to this one:
 * ./DMuiContextMenu.scss
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, {
  Component,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from 'react';
import classNames from 'classnames';

import { CommonProps } from '@elastic/eui/src/components/common';
import {
  EuiContextMenuPanel,
  EuiContextMenuPanelTransitionDirection,
  EuiContextMenuPanelTransitionType,
  // @ts-ignore
} from '@elastic/eui/lib/components/context_menu/context_menu_panel';
import {
  EuiContextMenuItem,
  EuiContextMenuItemProps,
  // @ts-ignore
} from '@elastic/eui/lib/components/context_menu/context_menu_item';

export type EuiContextMenuPanelId = string | number;

export type EuiContextMenuPanelItemDescriptor = Omit<
  EuiContextMenuItemProps,
  'hasPanel'
> & {
  name: React.ReactNode;
  key?: string;
  panel?: EuiContextMenuPanelId;
};

export interface EuiContextMenuPanelDescriptor {
  id: EuiContextMenuPanelId;
  title?: string;
  items?: EuiContextMenuPanelItemDescriptor[];
  content?: ReactNode;
  width?: number;
}

export type EuiContextMenuProps = CommonProps &
  Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
    panels?: EuiContextMenuPanelDescriptor[];
    initialPanelId?: EuiContextMenuPanelId;
  };

interface DMuiContextMenuProps extends EuiContextMenuProps {
  maximumHeight?: number;
}

function mapIdsToPanels(panels: EuiContextMenuPanelDescriptor[]) {
  const map: { [id: string]: EuiContextMenuPanelDescriptor } = {};

  panels.forEach((panel) => {
    map[panel.id] = panel;
  });

  return map;
}

function mapIdsToPreviousPanels(panels: EuiContextMenuPanelDescriptor[]) {
  const idToPreviousPanelIdMap: { [panel: string]: EuiContextMenuPanelId } = {};

  panels.forEach((panel) => {
    if (Array.isArray(panel.items)) {
      panel.items.forEach((item) => {
        const isCloseable = item.panel !== undefined;
        if (isCloseable) {
          idToPreviousPanelIdMap[item.panel!] = panel.id;
        }
      });
    }
  });

  return idToPreviousPanelIdMap;
}

function mapPanelItemsToPanels(panels: EuiContextMenuPanelDescriptor[]) {
  const idAndItemIndexToPanelIdMap: {
    [id: string]: { [index: string]: EuiContextMenuPanelId };
  } = {};

  panels.forEach((panel) => {
    idAndItemIndexToPanelIdMap[panel.id] = {};

    if (panel.items) {
      panel.items.forEach((item, index) => {
        if (item.panel) {
          idAndItemIndexToPanelIdMap[panel.id][index] = item.panel;
        }
      });
    }
  });

  return idAndItemIndexToPanelIdMap;
}

interface State {
  prevProps: {
    panels?: EuiContextMenuPanelDescriptor[];
  };
  idToPanelMap: { [id: string]: EuiContextMenuPanelDescriptor };
  idToPreviousPanelIdMap: { [panel: string]: EuiContextMenuPanelId };
  idAndItemIndexToPanelIdMap: {
    [id: string]: { [index: string]: EuiContextMenuPanelId };
  };
  idToRenderedItemsMap: { [id: string]: ReactElement[] };

  height?: number;
  outgoingPanelId?: EuiContextMenuPanelId;
  incomingPanelId?: EuiContextMenuPanelId;
  transitionDirection?: EuiContextMenuPanelTransitionDirection;
  isOutgoingPanelVisible: boolean;
  focusedItemIndex?: number;
  isUsingKeyboardToNavigate: boolean;
}

export class DMuiContextMenu extends Component<DMuiContextMenuProps, State> {
  static defaultProps: Partial<EuiContextMenuProps> = {
    panels: [],
  };
  contextMenuRef: React.RefObject<HTMLDivElement>;

  static getDerivedStateFromProps(
    nextProps: EuiContextMenuProps,
    prevState: State
  ): Partial<State> | null {
    const { panels } = nextProps;

    if (panels && prevState.prevProps.panels !== panels) {
      return {
        prevProps: { panels },
        idToPanelMap: mapIdsToPanels(panels),
        idToPreviousPanelIdMap: mapIdsToPreviousPanels(panels),
        idAndItemIndexToPanelIdMap: mapPanelItemsToPanels(panels),
      };
    }

    return null;
  }

  constructor(props: EuiContextMenuProps) {
    super(props);

    this.state = {
      prevProps: {},
      idToPanelMap: {},
      idToPreviousPanelIdMap: {},
      idAndItemIndexToPanelIdMap: {},
      idToRenderedItemsMap: this.mapIdsToRenderedItems(this.props.panels),

      height: undefined,
      outgoingPanelId: undefined,
      incomingPanelId: props.initialPanelId,
      transitionDirection: undefined,
      isOutgoingPanelVisible: false,
      focusedItemIndex: undefined,
      isUsingKeyboardToNavigate: false,
    };

    this.contextMenuRef = React.createRef();
  }

  componentDidUpdate(prevProps: EuiContextMenuProps) {
    if (prevProps.panels !== this.props.panels) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        idToRenderedItemsMap: this.mapIdsToRenderedItems(this.props.panels),
      });
    }
  }

  hasPreviousPanel = (panelId: EuiContextMenuPanelId) => {
    const previousPanelId = this.state.idToPreviousPanelIdMap[panelId];
    return typeof previousPanelId !== 'undefined';
  };

  showPanel(
    panelId: EuiContextMenuPanelId,
    direction?: EuiContextMenuPanelTransitionDirection
  ) {
    this.setState({
      outgoingPanelId: this.state.incomingPanelId,
      incomingPanelId: panelId,
      transitionDirection: direction,
      isOutgoingPanelVisible: true,
    });
  }

  showNextPanel = (itemIndex?: number) => {
    if (itemIndex == null) {
      return;
    }

    const nextPanelId = this.state.idAndItemIndexToPanelIdMap[
      this.state.incomingPanelId!
    ][itemIndex];

    if (nextPanelId) {
      if (this.state.isUsingKeyboardToNavigate) {
        this.setState({
          focusedItemIndex: 0,
        });
      }

      this.showPanel(nextPanelId, 'next');
    }
  };

  showPreviousPanel = () => {
    // If there's a previous panel, then we can close the current panel to go back to it.
    if (this.hasPreviousPanel(this.state.incomingPanelId!)) {
      const previousPanelId = this.state.idToPreviousPanelIdMap[
        this.state.incomingPanelId!
      ];

      // Set focus on the item which shows the panel we're leaving.
      const previousPanel = this.state.idToPanelMap[previousPanelId];
      const focusedItemIndex = previousPanel.items!.findIndex(
        (item) => item.panel === this.state.incomingPanelId
      );

      if (focusedItemIndex !== -1) {
        this.setState({
          focusedItemIndex,
        });
      }

      this.showPanel(previousPanelId, 'previous');
    }
  };

  onIncomingPanelHeightChange = (height: number) => {
    this.setState(({ height: prevHeight }) => {
      let _height = height;

      if (height === prevHeight) {
        return null;
      }

      // If a maximumHeight was specified, and the incoming height is larger
      // than that, set the panel's height to maximumHeight
      if (this.props.maximumHeight && height > this.props.maximumHeight) {
        _height = this.props.maximumHeight;
      }

      return { height: _height };
    });
  };

  onOutGoingPanelTransitionComplete = () => {
    // If we've got an active ContextMenu, and a max height that equals the menu's
    // height (meaning it's been shortened), scroll to the top of it
    if (
      this.contextMenuRef?.current &&
      this.props.maximumHeight === this.state.height
    ) {
      this.contextMenuRef.current.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    }

    this.setState({
      isOutgoingPanelVisible: false,
    });
  };

  onUseKeyboardToNavigate = () => {
    if (!this.state.isUsingKeyboardToNavigate) {
      this.setState({
        isUsingKeyboardToNavigate: true,
      });
    }
  };

  mapIdsToRenderedItems = (panels: EuiContextMenuPanelDescriptor[] = []) => {
    const idToRenderedItemsMap: { [id: string]: ReactElement[] } = {};

    // Pre-rendering the items lets us check reference equality inside of EuiContextMenuPanel.
    panels.forEach((panel) => {
      idToRenderedItemsMap[panel.id] = this.renderItems(panel.items);
    });

    return idToRenderedItemsMap;
  };

  renderItems(items: EuiContextMenuPanelItemDescriptor[] = []) {
    return items.map((item, index) => {
      const {
        panel,
        name,
        key,
        icon,
        onClick,
        toolTipTitle,
        toolTipContent,
        ...rest
      } = item;

      const onClickHandler = panel
        ? (event: React.MouseEvent) => {
            if (onClick && event) {
              event.persist();
            }
            // This component is commonly wrapped in a EuiOutsideClickDetector, which means we'll
            // need to wait for that logic to complete before re-rendering the DOM via showPanel.
            window.requestAnimationFrame(() => {
              if (onClick) {
                onClick(event);
              }
              this.showNextPanel(index);
            });
          }
        : onClick;

      return (
        <EuiContextMenuItem
          key={key || (typeof name === 'string' ? name : undefined) || index}
          icon={icon}
          onClick={onClickHandler}
          hasPanel={Boolean(panel)}
          toolTipTitle={toolTipTitle}
          toolTipContent={toolTipContent}
          {...rest}
        >
          {name}
        </EuiContextMenuItem>
      );
    });
  }

  renderPanel(
    panelId: EuiContextMenuPanelId,
    transitionType: EuiContextMenuPanelTransitionType
  ) {
    const panel = this.state.idToPanelMap[panelId];

    if (!panel) {
      return;
    }

    // As above, we need to wait for EuiOutsideClickDetector to complete its logic before
    // re-rendering via showPanel.
    let onClose;
    if (this.hasPreviousPanel(panelId)) {
      onClose = () => window.requestAnimationFrame(this.showPreviousPanel);
    }

    return (
      <EuiContextMenuPanel
        key={panelId}
        className="euiContextMenu__panel"
        onHeightChange={
          transitionType === 'in' ? this.onIncomingPanelHeightChange : undefined
        }
        onTransitionComplete={
          transitionType === 'out'
            ? this.onOutGoingPanelTransitionComplete
            : undefined
        }
        title={panel.title}
        onClose={onClose}
        transitionType={
          this.state.isOutgoingPanelVisible ? transitionType : undefined
        }
        transitionDirection={
          this.state.isOutgoingPanelVisible
            ? this.state.transitionDirection
            : undefined
        }
        hasFocus={transitionType === 'in'}
        items={this.state.idToRenderedItemsMap[panelId]}
        initialFocusedItemIndex={
          this.state.isUsingKeyboardToNavigate
            ? this.state.focusedItemIndex
            : undefined
        }
        onUseKeyboardToNavigate={this.onUseKeyboardToNavigate}
        showNextPanel={this.showNextPanel}
        showPreviousPanel={this.showPreviousPanel}
      >
        {panel.content}
      </EuiContextMenuPanel>
    );
  }

  render() {
    const {
      panels,
      className,
      initialPanelId,
      maximumHeight,
      ...rest
    } = this.props;

    const incomingPanel = this.renderPanel(this.state.incomingPanelId!, 'in');
    let outgoingPanel;

    if (this.state.isOutgoingPanelVisible) {
      outgoingPanel = this.renderPanel(this.state.outgoingPanelId!, 'out');
    }

    const width =
      this.state.idToPanelMap[this.state.incomingPanelId!] &&
      this.state.idToPanelMap[this.state.incomingPanelId!].width
        ? this.state.idToPanelMap[this.state.incomingPanelId!].width
        : undefined;

    const classes = classNames('euiContextMenu', 'dmContextMenu', className);

    return (
      <div
        className={classes}
        style={{ height: this.state.height, width: width }}
        ref={this.contextMenuRef}
        {...rest}
      >
        {outgoingPanel}
        {incomingPanel}
      </div>
    );
  }
}
